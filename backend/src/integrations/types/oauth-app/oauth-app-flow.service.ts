import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../../core/error-codes.js';
import { OauthAppCallbackDto } from '../../dto/oauth-app-callback.dto.js';
import { StartOauthAppDto } from '../../dto/start-oauth-app.dto.js';
import type { Integration } from '../../entities/integration.entity.js';
import { decryptRow } from '../../integration-connection-test.service.js';
import { IntegrationCredentialService } from '../../integration-credential.service.js';
import { flowUnsupported, limitReached } from '../../integration-http-errors.js';
import type { IntegrationResponse } from '../../integration-response.js';
import { IntegrationStoreService } from '../../integration-store.service.js';
import { IntegrationsEncryptionService } from '../../integrations-encryption.service.js';
import { IntegrationsService, normalizeLabel } from '../../integrations.service.js';
import { Secret } from '../../secret.js';
import type { ValidatedCredential } from '../integration-type-strategy.js';
import { authorizeUrl } from './oauth-app-authorize-url.js';
import type { EnabledOauthAppConfig } from './oauth-app-config.js';
import { oauthAppTokenOf } from './oauth-app-credential.js';
import { OauthAppStrategy } from './oauth-app.strategy.js';
import { ConsumedOauthState, OauthStateService } from './oauth-state.service.js';

/** What the callback produced: whether a row was created (201) or replaced (200). */
export interface OauthAppCallbackResult {
  created: boolean;
  integration: IntegrationResponse;
}

/**
 * The OAuth App redirect flow (see
 * `docs/agents/specs/integrations/types/oauth-app.md#flow`): `start` checks
 * the request and answers GitHub's authorize URL (no GitHub call); `callback`
 * consumes the single-use `state`, validates the code through the generic
 * credential pipeline (same cool-off as a pasted credential) and stores the
 * token. A new token Kerghan doesn't keep is revoked best-effort.
 */
@Injectable()
export class OauthAppFlowService {
  private readonly strategy: OauthAppStrategy;
  private readonly states: OauthStateService;
  private readonly store: IntegrationStoreService;
  private readonly credentials: IntegrationCredentialService;
  private readonly encryption: IntegrationsEncryptionService;
  private readonly integrations: IntegrationsService;

  /**
   * @param {OauthAppStrategy} strategy - The `oauth_app` strategy (config, validation, revocation).
   * @param {OauthStateService} states - Issues and consumes the flow's `state`.
   * @param {IntegrationStoreService} store - Owner-scoped persistence.
   * @param {IntegrationCredentialService} credentials - Cool-off, validation and sealing.
   * @param {IntegrationsEncryptionService} encryption - Decrypts the previous token on replace.
   * @param {IntegrationsService} integrations - The per-user cap and the response builder.
   */
  constructor(
    strategy: OauthAppStrategy,
    states: OauthStateService,
    store: IntegrationStoreService,
    credentials: IntegrationCredentialService,
    encryption: IntegrationsEncryptionService,
    integrations: IntegrationsService,
  ) {
    this.strategy = strategy;
    this.states = states;
    this.store = store;
    this.credentials = credentials;
    this.encryption = encryption;
    this.integrations = integrations;
  }

  /**
   * Starts a flow. Checks, in order: type enabled (404) → exactly one of
   * `label`/`integrationId` (400) → replace target owned (404) and of type
   * `oauth_app` (400) → cool-off (423) → create: cap and label (409). Then
   * stores a `state` and answers the authorize URL.
   * @param {number} userId - The caller's id.
   * @param {StartOauthAppDto} dto - The validated body.
   * @returns {Promise<{ authorizeUrl: string }>} GitHub's authorize URL.
   */
  async start(userId: number, dto: StartOauthAppDto): Promise<{ authorizeUrl: string }> {
    const config = this.enabledConfig();
    const target = exactlyOneTarget(dto);

    if ('integrationUuid' in target) {
      this.assertOauthApp(await this.store.findOwned(userId, target.integrationUuid));
    }

    await this.credentials.assertNotLocked(userId);

    if ('label' in target) {
      await this.assertCreatable(userId, target.label);
    }

    const { state, codeChallenge } = await this.states.issue(userId, target);

    return { authorizeUrl: authorizeUrl(config, state, codeChallenge) };
  }

  /**
   * Completes a flow. Checks, in order: type enabled (404) → `state` (400)
   * → replace target owned (404) → cool-off (423) → create: cap and label
   * (409) → code exchange and token check (counted like a pasted
   * credential) → store. Replace revokes the previous token best-effort.
   * @param {number} userId - The caller's id.
   * @param {OauthAppCallbackDto} dto - The validated body.
   * @returns {Promise<OauthAppCallbackResult>} The created or updated integration.
   */
  async callback(userId: number, dto: OauthAppCallbackDto): Promise<OauthAppCallbackResult> {
    this.enabledConfig();

    const consumed = await this.states.consume(userId, dto.state);

    if (consumed.purpose === 'replace') {
      this.assertOauthApp(await this.store.findOwned(userId, consumed.integrationUuid));
    }

    await this.credentials.assertNotLocked(userId);

    if (consumed.purpose === 'create') {
      await this.assertCreatable(userId, consumed.label);
    }

    const validated = await this.credentials.validate(userId, {
      strategy: this.strategy,
      secret: new Secret({ code: dto.code, codeVerifier: consumed.codeVerifier.reveal() }),
    });

    return this.storeOrRevoke(userId, consumed, validated);
  }

  /**
   * Stores the validated token; on any failure revokes it best-effort and rethrows.
   * @param {number} userId - The caller's id.
   * @param {ConsumedOauthState} consumed - What the flow was started for.
   * @param {ValidatedCredential} validated - The validated credential.
   * @returns {Promise<OauthAppCallbackResult>} The created or updated integration.
   */
  private async storeOrRevoke(
    userId: number,
    consumed: ConsumedOauthState,
    validated: ValidatedCredential,
  ): Promise<OauthAppCallbackResult> {
    const token = new Secret(oauthAppTokenOf(validated.secret));

    try {
      return consumed.purpose === 'create'
        ? await this.create(userId, consumed.label, validated)
        : await this.replace(userId, consumed.integrationUuid, validated);
    } catch (error) {
      await this.strategy.revoke(token, clientIdOf(validated.metadata), { userId });
      throw error;
    }
  }

  /**
   * Inserts an `active` row within the per-user cap.
   * @param {number} userId - The caller's id.
   * @param {string} label - The label validated at start.
   * @param {ValidatedCredential} validated - The validated credential.
   * @returns {Promise<OauthAppCallbackResult>} The created integration.
   */
  private async create(userId: number, label: string, validated: ValidatedCredential): Promise<OauthAppCallbackResult> {
    const uuid = randomUUID();
    const row = await this.store.insertWithinCap({
      uuid,
      userId,
      provider: 'github',
      type: this.strategy.type,
      label,
      labelNormalized: normalizeLabel(label),
      ...this.freshCredentialColumns(validated, uuid),
    }, this.integrations.maxPerUser);

    return { created: true, integration: this.integrations.respond(row) };
  }

  /**
   * Refreshes an existing row like a generic replace credential, then
   * revokes its previous token best-effort (unless GitHub returned the same one).
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The target integration's uuid.
   * @param {ValidatedCredential} validated - The validated credential.
   * @returns {Promise<OauthAppCallbackResult>} The updated integration.
   */
  private async replace(userId: number, uuid: string, validated: ValidatedCredential): Promise<OauthAppCallbackResult> {
    // Looked up again: the row may have been deleted while GitHub was being called.
    const row = await this.store.findOwned(userId, uuid);
    const previous = decryptRow(this.encryption, this.strategy, row);
    const previousClientId = clientIdOf(row.metadata);
    const updated = await this.store.updateOwned(row, this.freshCredentialColumns(validated, row.uuid));
    const newToken = oauthAppTokenOf(validated.secret);

    if (previous !== null && oauthAppTokenOf(previous) !== newToken) {
      await this.strategy.revoke(new Secret(oauthAppTokenOf(previous)), previousClientId, { integrationUuid: uuid, userId });
    }

    return { created: false, integration: this.integrations.respond(updated) };
  }

  /**
   * The columns a successful validation writes: sealed credential and a fresh `active` status.
   * @param {ValidatedCredential} validated - The validated credential.
   * @param {string} uuid - The row's uuid (part of the AAD).
   * @returns {Partial<Integration>} The columns.
   */
  private freshCredentialColumns(validated: ValidatedCredential, uuid: string): Partial<Integration> {
    return {
      ...this.credentials.seal(this.strategy, validated, uuid),
      status: 'active',
      statusReason: null,
      lastTestedAt: new Date(),
      lastTestResult: 'success',
    };
  }

  /**
   * The enabled config; a disabled type answers 404 as if the routes didn't exist.
   * @returns {EnabledOauthAppConfig} The config.
   */
  private enabledConfig(): EnabledOauthAppConfig {
    const config = this.strategy.enabledConfig();

    if (config === null) {
      throw new NotFoundException();
    }

    return config;
  }

  /**
   * Rejects a replace target of another type (changing type means delete and create).
   * @param {Integration} row - The owned row.
   * @returns {void}
   */
  private assertOauthApp(row: Integration): void {
    if (row.type !== this.strategy.type) {
      throw flowUnsupported();
    }
  }

  /**
   * Create only: the per-user cap (409) and label uniqueness (409).
   * @param {number} userId - The caller's id.
   * @param {string} label - The label.
   * @returns {Promise<void>} Resolves when a row can be created.
   */
  private async assertCreatable(userId: number, label: string): Promise<void> {
    if (await this.store.countOwned(userId) >= this.integrations.maxPerUser) {
      throw limitReached();
    }

    await this.store.assertLabelFree(userId, normalizeLabel(label));
  }
}

/**
 * Enforces exactly one of `label` and `integrationId`.
 * @param {{ label?: string, integrationId?: string }} dto - The validated start body.
 * @returns {{ label: string } | { integrationUuid: string }} The flow's target.
 */
export function exactlyOneTarget(
  dto: { label?: string; integrationId?: string },
): { label: string } | { integrationUuid: string } {
  const hasLabel = dto.label !== undefined;

  if (hasLabel === (dto.integrationId !== undefined)) {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_FAILED,
      message: ['exactly one of label and integrationId must be given'],
    });
  }

  return hasLabel ? { label: dto.label as string } : { integrationUuid: dto.integrationId as string };
}

/**
 * The client id stored in metadata.
 * @param {Record<string, unknown>} metadata - The metadata.
 * @returns {string | null} The client id, or `null` when absent.
 */
function clientIdOf(metadata: Record<string, unknown>): string | null {
  return typeof metadata.clientId === 'string' ? metadata.clientId : null;
}
