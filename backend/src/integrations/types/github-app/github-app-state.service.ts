import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  GithubAppStateStage,
  IntegrationGithubAppState,
} from '../../entities/integration-github-app-state.entity.js';
import { invalidRedirectState } from '../../integration-http-errors.js';
import { OAUTH_STATE_PATTERN } from '../oauth-app/oauth-state.service.js';
import { secretMatches, sha256Hex } from '../shared/state-secret.js';

// How long a flow step stays valid (GitHub's codes also live 10 minutes).
export const GITHUB_APP_STATE_TTL_MS = 10 * 60 * 1000;
// Most pending rows kept per user, including the one being issued.
export const GITHUB_APP_STATE_MAX_PENDING = 5;
// Most candidate installation ids a `select` row records.
export const GITHUB_APP_MAX_CANDIDATES = 100;
// Random bytes in the `state` secret.
const RANDOM_BYTES = 32;
// Shape of a `state` value: `<uuid>.<43 base64url characters>` (same as the OAuth App's).
export const GITHUB_APP_STATE_PATTERN = OAUTH_STATE_PATTERN;

/** What a flow targets: a new integration (with its label), or an existing one's credential. */
export type GithubAppStateTarget =
  | { purpose: 'create'; label: string }
  | { purpose: 'replace'; integrationUuid: string };

/**
 * A consumed flow step: what it was started for and, for a `select` row,
 * the verified candidate installation ids (empty for a `redirect` row).
 */
export interface ConsumedGithubAppState {
  target: GithubAppStateTarget;
  candidates: number[];
}

/**
 * Issues and consumes the server-side, single-use `state` of the GitHub App
 * flow (see `docs/agents/specs/integrations/types/github-app.md#state`):
 * `redirect` rows (issued by start, consumed by callback) and `select` rows
 * (issued by a callback answering a selection, consumed by select).
 *
 * The `state` and its secret are never logged nor put in an error message;
 * only the SHA-256 of the secret is stored. Every rejected `state` answers
 * the same 400 `INTEGRATION_REDIRECT_STATE_INVALID`.
 */
@Injectable()
export class GithubAppStateService {
  private readonly repository: Repository<IntegrationGithubAppState>;

  /**
   * @param {Repository<IntegrationGithubAppState>} repository - The `integrations_github_app_states` repository.
   */
  constructor(
  @InjectRepository(IntegrationGithubAppState) repository: Repository<IntegrationGithubAppState>,
  ) {
    this.repository = repository;
  }

  /**
   * Issues a `redirect` row for a flow being started.
   * @param {number} userId - The initiating user.
   * @param {GithubAppStateTarget} target - Create (with label) or replace (with target uuid).
   * @param {Date} [now] - The current time.
   * @returns {Promise<string>} The `state` value (`<uuid>.<secret>`).
   */
  async issueRedirect(userId: number, target: GithubAppStateTarget, now: Date = new Date()): Promise<string> {
    return this.issue(userId, 'redirect', target, null, now);
  }

  /**
   * Issues a `select` row carrying the consumed row's target and the verified candidates.
   * @param {number} userId - The user.
   * @param {GithubAppStateTarget} target - The consumed `redirect` row's target.
   * @param {number[]} candidates - The verified installation ids (at most 100 are kept).
   * @param {Date} [now] - The current time.
   * @returns {Promise<string>} The `state` value (`<uuid>.<secret>`).
   */
  async issueSelect(
    userId: number,
    target: GithubAppStateTarget,
    candidates: number[],
    now: Date = new Date(),
  ): Promise<string> {
    return this.issue(userId, 'select', target, candidates.slice(0, GITHUB_APP_MAX_CANDIDATES), now);
  }

  /**
   * Consumes a `state` exactly once: looks it up bound to the user, deletes
   * it atomically (only the caller that deleted it proceeds), then checks
   * the secret in constant time, the expiry and the stage.
   * @param {number} userId - The user completing the step.
   * @param {string} state - The submitted `state` value.
   * @param {GithubAppStateStage} stage - The stage the route expects.
   * @param {Date} [now] - The current time.
   * @returns {Promise<ConsumedGithubAppState>} What the flow was started for.
   * @throws {BadRequestException} 400 `INTEGRATION_REDIRECT_STATE_INVALID` for any invalid `state`.
   */
  async consume(
    userId: number,
    state: string,
    stage: GithubAppStateStage,
    now: Date = new Date(),
  ): Promise<ConsumedGithubAppState> {
    if (!GITHUB_APP_STATE_PATTERN.test(state)) {
      throw invalidRedirectState();
    }

    const [uuid, secret] = state.split('.');
    const row = await this.repository.findOne({ where: { uuid, userId } });

    if (row === null) {
      throw invalidRedirectState();
    }

    const { affected } = await this.repository.delete({ id: row.id });
    const valid = affected === 1 && secretMatches(secret, row.secretHash)
      && row.expiresAt.getTime() > now.getTime() && row.stage === stage;

    if (!valid) {
      throw invalidRedirectState();
    }

    return toConsumed(row);
  }

  /**
   * Purges expired rows, keeps the user under the pending cap, then stores a new row.
   * @param {number} userId - The user.
   * @param {GithubAppStateStage} stage - The new row's stage.
   * @param {GithubAppStateTarget} target - The flow's target.
   * @param {number[] | null} candidates - The candidates (`select` only).
   * @param {Date} now - The current time.
   * @returns {Promise<string>} The `state` value.
   */
  private async issue(
    userId: number,
    stage: GithubAppStateStage,
    target: GithubAppStateTarget,
    candidates: number[] | null,
    now: Date,
  ): Promise<string> {
    await this.repository.delete({ expiresAt: LessThanOrEqual(now) });
    await this.prunePending(userId);

    const uuid = randomUUID();
    const secret = randomBytes(RANDOM_BYTES).toString('base64url');

    await this.repository.save(this.repository.create({
      uuid,
      userId,
      secretHash: sha256Hex(secret),
      stage,
      purpose: target.purpose,
      label: target.purpose === 'create' ? target.label : null,
      integrationUuid: target.purpose === 'replace' ? target.integrationUuid : null,
      candidateInstallationIds: candidates,
      expiresAt: new Date(now.getTime() + GITHUB_APP_STATE_TTL_MS),
    }));

    return `${uuid}.${secret}`;
  }

  /**
   * Deletes the user's oldest pending rows so that, with the new one, at most
   * `GITHUB_APP_STATE_MAX_PENDING` remain.
   * @param {number} userId - The user.
   * @returns {Promise<void>}
   */
  private async prunePending(userId: number): Promise<void> {
    const pending = await this.repository.find({ where: { userId }, order: { id: 'DESC' }, select: { id: true } });
    const stale = pending.slice(GITHUB_APP_STATE_MAX_PENDING - 1).map((row) => row.id);

    if (stale.length > 0) {
      await this.repository.delete({ id: In(stale) });
    }
  }
}

/**
 * Maps a consumed row's target, rejecting an inconsistent row.
 * @param {IntegrationGithubAppState} row - The deleted row.
 * @returns {GithubAppStateTarget} The target.
 * @throws {BadRequestException} When the row has no label / no target.
 */
function targetOf(row: IntegrationGithubAppState): GithubAppStateTarget {
  if (row.purpose === 'create' && row.label !== null) {
    return { purpose: 'create', label: row.label };
  }

  if (row.purpose === 'replace' && row.integrationUuid !== null) {
    return { purpose: 'replace', integrationUuid: row.integrationUuid };
  }

  throw invalidRedirectState();
}

/**
 * Whether a stored candidate list is an array of positive safe integers.
 * @param {unknown} value - The stored JSON.
 * @returns {boolean} Whether it is well-formed.
 */
function isCandidateList(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((id) => Number.isSafeInteger(id) && (id as number) > 0);
}

/**
 * Maps a consumed row to its public shape.
 * @param {IntegrationGithubAppState} row - The deleted row.
 * @returns {ConsumedGithubAppState} The consumed step.
 * @throws {BadRequestException} When the row is inconsistent.
 */
function toConsumed(row: IntegrationGithubAppState): ConsumedGithubAppState {
  const target = targetOf(row);

  if (row.stage === 'redirect') {
    return { target, candidates: [] };
  }

  if (!isCandidateList(row.candidateInstallationIds)) {
    throw invalidRedirectState();
  }

  return { target, candidates: row.candidateInstallationIds };
}
