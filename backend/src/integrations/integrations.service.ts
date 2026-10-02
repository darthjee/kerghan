import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../core/logger.service.js';
import { getNumberConfig } from '../core/numeric-config.js';
import { CreateIntegrationDto } from './dto/create-integration.dto.js';
import { ReplaceCredentialDto } from './dto/replace-credential.dto.js';
import type { Integration } from './entities/integration.entity.js';
import { decryptRow, IntegrationConnectionTestService } from './integration-connection-test.service.js';
import { IntegrationCredentialService } from './integration-credential.service.js';
import { limitReached } from './integration-http-errors.js';
import { IntegrationResponse, toIntegrationResponse, toIntegrationView } from './integration-response.js';
import { IntegrationStoreService } from './integration-store.service.js';
import { IntegrationsEncryptionService } from './integrations-encryption.service.js';
import { EnabledIntegrationType, IntegrationTypeRegistry } from './types/integration-type-registry.js';

// Default per-user cap, used when `KERGHAN_INTEGRATIONS_MAX_PER_USER` is unset.
export const DEFAULT_INTEGRATIONS_MAX_PER_USER = 20;

/**
 * Normalises a label for the case-insensitive uniqueness check.
 * @param {string} label - The (already trimmed) label.
 * @returns {string} The trimmed, lower-cased label.
 */
export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * The Integrations module's business logic (see
 * `docs/agents/specs/integrations/api.md`). Every action is scoped to the
 * caller; on `:uuid` actions the owner lookup runs first, so a foreign uuid
 * answers 404 before any other check. Responses are built from an explicit
 * allowlist and never decrypt anything.
 */
@Injectable()
export class IntegrationsService {
  private readonly store: IntegrationStoreService;
  private readonly credentials: IntegrationCredentialService;
  private readonly connectionTest: IntegrationConnectionTestService;
  private readonly encryption: IntegrationsEncryptionService;
  private readonly registry: IntegrationTypeRegistry;
  private readonly logger: LoggerService;
  private readonly maxPerUser: number;

  /**
   * @param {IntegrationStoreService} store - Owner-scoped persistence.
   * @param {IntegrationCredentialService} credentials - The create/replace credential pipeline.
   * @param {IntegrationConnectionTestService} connectionTest - The test-connection action.
   * @param {IntegrationsEncryptionService} encryption - Key-id checks and decryption on delete.
   * @param {IntegrationTypeRegistry} registry - Resolves type strategies.
   * @param {LoggerService} logger - Logs best-effort delete failures with safe fields only.
   * @param {ConfigService} configService - Supplies `KERGHAN_INTEGRATIONS_MAX_PER_USER`.
   */
  constructor(
    store: IntegrationStoreService,
    credentials: IntegrationCredentialService,
    connectionTest: IntegrationConnectionTestService,
    encryption: IntegrationsEncryptionService,
    registry: IntegrationTypeRegistry,
    logger: LoggerService,
    configService: ConfigService,
  ) {
    this.store = store;
    this.credentials = credentials;
    this.connectionTest = connectionTest;
    this.encryption = encryption;
    this.registry = registry;
    this.logger = logger;
    this.maxPerUser = getNumberConfig(configService, 'KERGHAN_INTEGRATIONS_MAX_PER_USER', DEFAULT_INTEGRATIONS_MAX_PER_USER);
  }

  /**
   * Lists the caller's integrations, newest first, whatever their status.
   * @param {number} userId - The caller's id.
   * @returns {Promise<IntegrationResponse[]>} The integrations.
   */
  async list(userId: number): Promise<IntegrationResponse[]> {
    const rows = await this.store.listOwned(userId);

    return rows.map((row) => this.respond(row));
  }

  /**
   * Shows one of the caller's integrations.
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<IntegrationResponse>} The integration.
   */
  async show(userId: number, uuid: string): Promise<IntegrationResponse> {
    return this.respond(await this.store.findOwned(userId, uuid));
  }

  /**
   * Lists the types this server can create.
   * @returns {EnabledIntegrationType[]} The enabled types, in registry order.
   */
  enabledTypes(): EnabledIntegrationType[] {
    return this.registry.enabledTypes();
  }

  /**
   * Creates an integration. Checks, in order: flow kind and credential
   * shape → failure cool-off → per-user cap → label uniqueness → GitHub
   * validation. Nothing is stored on any failure. The cap is checked again,
   * atomically, with the insert (see `IntegrationStoreService#insertWithinCap`).
   * @param {number} userId - The caller's id (the owner).
   * @param {CreateIntegrationDto} dto - The validated create envelope.
   * @returns {Promise<IntegrationResponse>} The created integration.
   */
  async create(userId: number, dto: CreateIntegrationDto): Promise<IntegrationResponse> {
    const parsed = this.credentials.parse(dto.type, dto.credential);
    const labelNormalized = normalizeLabel(dto.label);

    await this.credentials.assertNotLocked(userId);

    if (await this.store.countOwned(userId) >= this.maxPerUser) {
      throw limitReached();
    }

    await this.store.assertLabelFree(userId, labelNormalized);

    const validated = await this.credentials.validate(userId, parsed);
    const uuid = randomUUID();
    const row = await this.store.insertWithinCap({
      uuid,
      userId,
      provider: dto.provider,
      type: parsed.strategy.type,
      label: dto.label,
      labelNormalized,
      status: 'active',
      statusReason: null,
      lastTestedAt: new Date(),
      lastTestResult: 'success',
      ...this.credentials.seal(parsed.strategy, validated, uuid),
    }, this.maxPerUser);

    return this.respond(row);
  }

  /**
   * Renames one of the caller's integrations; only the label changes.
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @param {string} label - The new (trimmed) label.
   * @returns {Promise<IntegrationResponse>} The renamed integration.
   */
  async rename(userId: number, uuid: string, label: string): Promise<IntegrationResponse> {
    const row = await this.store.findOwned(userId, uuid);
    const labelNormalized = normalizeLabel(label);

    await this.store.assertLabelFree(userId, labelNormalized, row.id);

    return this.respond(await this.store.updateOwned(row, { label, labelNormalized }));
  }

  /**
   * Replaces the credential of one of the caller's integrations. Checks, in
   * order: owner lookup → flow kind and credential shape for the row's type
   * → failure cool-off → GitHub validation. On failure the row is unchanged.
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @param {ReplaceCredentialDto} dto - The validated body.
   * @returns {Promise<IntegrationResponse>} The updated integration.
   */
  async replaceCredential(userId: number, uuid: string, dto: ReplaceCredentialDto): Promise<IntegrationResponse> {
    const row = await this.store.findOwned(userId, uuid);
    const parsed = this.credentials.parse(row.type, dto.credential);

    await this.credentials.assertNotLocked(userId);

    const validated = await this.credentials.validate(userId, parsed);
    const updated = await this.store.updateOwned(row, {
      ...this.credentials.seal(parsed.strategy, validated, row.uuid),
      status: 'active',
      statusReason: null,
      lastTestedAt: new Date(),
      lastTestResult: 'success',
    });

    return this.respond(updated);
  }

  /**
   * Tests one of the caller's integrations against GitHub.
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<IntegrationResponse>} The integration with the test outcome.
   */
  async test(userId: number, uuid: string): Promise<IntegrationResponse> {
    return this.respond(await this.connectionTest.test(userId, uuid));
  }

  /**
   * Deletes one of the caller's integrations, after the type's best-effort
   * cleanup (which never blocks the deletion).
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<void>} Resolves once deleted.
   */
  async delete(userId: number, uuid: string): Promise<void> {
    const row = await this.store.findOwned(userId, uuid);

    await this.cleanUp(row);
    await this.store.deleteOwned(row);
  }

  /**
   * Runs the type's `onDelete`, logging (safe fields only) and swallowing any failure.
   * @param {Integration} row - The row being deleted.
   * @returns {Promise<void>} Resolves once the cleanup was attempted.
   */
  private async cleanUp(row: Integration): Promise<void> {
    try {
      const strategy = this.registry.get(row.type);

      await strategy.onDelete(decryptRow(this.encryption, strategy, row), toIntegrationView(row));
    } catch (error) {
      this.logger.warn('integration delete cleanup failed', {
        uuid: row.uuid,
        userId: row.userId,
        type: row.type,
        error: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  /**
   * Serialises a row for its owner.
   * @param {Integration} row - The row.
   * @returns {IntegrationResponse} The response body.
   */
  private respond(row: Integration): IntegrationResponse {
    return toIntegrationResponse(row, this.encryption.isDecryptableKeyId(row.secretKeyId));
  }
}
