import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { IntegrationOauthState } from '../../entities/integration-oauth-state.entity.js';
import { invalidRedirectState } from '../../integration-http-errors.js';
import { Secret } from '../../secret.js';

// How long a started flow stays valid (GitHub's codes also live 10 minutes).
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
// Most pending flows kept per user, including the one being started.
export const OAUTH_STATE_MAX_PENDING = 5;
// Random bytes in the `state` secret and in the PKCE `code_verifier`.
const RANDOM_BYTES = 32;
// Shape of a `state` value: `<uuid>.<43 base64url characters>`.
export const OAUTH_STATE_PATTERN = /^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/;

/** What a started flow targets: a new integration, or an existing one's credential. */
export type OauthStateTarget = { label: string } | { integrationUuid: string };

/** A freshly issued flow: the opaque `state` and the PKCE challenge for the authorize URL. */
export interface IssuedOauthState {
  state: string;
  codeChallenge: string;
}

/** A consumed flow: what it was started for, and its PKCE verifier. */
export type ConsumedOauthState =
  | { purpose: 'create'; label: string; codeVerifier: Secret<string> }
  | { purpose: 'replace'; integrationUuid: string; codeVerifier: Secret<string> };

/**
 * Issues and consumes the server-side, single-use, PKCE-backed `state` of
 * the OAuth App redirect flow (see
 * `docs/agents/specs/integrations/types/oauth-app.md#state`).
 *
 * The `state`, its secret and the verifier are never logged nor put in an
 * error message; only the SHA-256 of the secret is stored. Every rejected
 * `state` answers the same 400 `INTEGRATION_REDIRECT_STATE_INVALID`.
 */
@Injectable()
export class OauthStateService {
  private readonly repository: Repository<IntegrationOauthState>;

  /**
   * @param {Repository<IntegrationOauthState>} repository - The `integrations_oauth_states` repository.
   */
  constructor(@InjectRepository(IntegrationOauthState) repository: Repository<IntegrationOauthState>) {
    this.repository = repository;
  }

  /**
   * Starts a flow: purges expired rows, keeps at most `OAUTH_STATE_MAX_PENDING - 1`
   * of the user's pending rows, then stores a new one.
   * @param {number} userId - The initiating user.
   * @param {OauthStateTarget} target - `{ label }` (create) or `{ integrationUuid }` (replace).
   * @param {Date} [now] - The current time.
   * @returns {Promise<IssuedOauthState>} The `state` value and the PKCE challenge.
   */
  async issue(userId: number, target: OauthStateTarget, now: Date = new Date()): Promise<IssuedOauthState> {
    await this.repository.delete({ expiresAt: LessThanOrEqual(now) });
    await this.prunePending(userId);

    const uuid = randomUUID();
    const secret = randomBytes(RANDOM_BYTES).toString('base64url');
    const codeVerifier = randomBytes(RANDOM_BYTES).toString('base64url');

    await this.repository.save(this.repository.create({
      uuid,
      userId,
      secretHash: sha256Hex(secret),
      purpose: 'label' in target ? 'create' : 'replace',
      label: 'label' in target ? target.label : null,
      integrationUuid: 'integrationUuid' in target ? target.integrationUuid : null,
      codeVerifier,
      expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
    }));

    return { state: `${uuid}.${secret}`, codeChallenge: pkceChallenge(codeVerifier) };
  }

  /**
   * Consumes a `state` exactly once: looks it up bound to the user, deletes
   * it atomically (only the caller that deleted it proceeds), then checks
   * the secret in constant time and the expiry.
   * @param {number} userId - The user completing the flow.
   * @param {string} state - The submitted `state` value.
   * @param {Date} [now] - The current time.
   * @returns {Promise<ConsumedOauthState>} What the flow was started for, and its verifier.
   * @throws {BadRequestException} 400 `INTEGRATION_REDIRECT_STATE_INVALID` for any invalid `state`.
   */
  async consume(userId: number, state: string, now: Date = new Date()): Promise<ConsumedOauthState> {
    if (!OAUTH_STATE_PATTERN.test(state)) {
      throw invalidRedirectState();
    }

    const [uuid, secret] = state.split('.');
    const row = await this.repository.findOne({ where: { uuid, userId } });

    if (row === null) {
      throw invalidRedirectState();
    }

    const { affected } = await this.repository.delete({ id: row.id });

    if (affected !== 1 || !secretMatches(secret, row.secretHash) || row.expiresAt.getTime() <= now.getTime()) {
      throw invalidRedirectState();
    }

    return toConsumed(row);
  }

  /**
   * Deletes the user's oldest pending rows so that, with the new one, at most
   * `OAUTH_STATE_MAX_PENDING` remain.
   * @param {number} userId - The user.
   * @returns {Promise<void>}
   */
  private async prunePending(userId: number): Promise<void> {
    const pending = await this.repository.find({ where: { userId }, order: { id: 'DESC' }, select: { id: true } });
    const stale = pending.slice(OAUTH_STATE_MAX_PENDING - 1).map((row) => row.id);

    if (stale.length > 0) {
      await this.repository.delete({ id: In(stale) });
    }
  }
}

/**
 * The PKCE `S256` challenge: base64url (no padding) of SHA-256 over the verifier.
 * @param {string} codeVerifier - The verifier.
 * @returns {string} The challenge.
 */
export function pkceChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Hex SHA-256 of a value.
 * @param {string} value - The value.
 * @returns {string} 64 hex characters.
 */
function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Compares the submitted secret's hash with the stored one in constant time.
 * @param {string} secret - The submitted secret.
 * @param {string} storedHash - The stored hex SHA-256.
 * @returns {boolean} Whether they match.
 */
function secretMatches(secret: string, storedHash: string): boolean {
  const submitted = Buffer.from(sha256Hex(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');

  return submitted.length === stored.length && timingSafeEqual(submitted, stored);
}

/**
 * Maps a consumed row to its public shape.
 * @param {IntegrationOauthState} row - The deleted row.
 * @returns {ConsumedOauthState} The consumed flow.
 * @throws {BadRequestException} When the row is inconsistent (no label / no target).
 */
function toConsumed(row: IntegrationOauthState): ConsumedOauthState {
  const codeVerifier = new Secret(row.codeVerifier);

  if (row.purpose === 'create' && row.label !== null) {
    return { purpose: 'create', label: row.label, codeVerifier };
  }

  if (row.purpose === 'replace' && row.integrationUuid !== null) {
    return { purpose: 'replace', integrationUuid: row.integrationUuid, codeVerifier };
  }

  throw invalidRedirectState();
}
