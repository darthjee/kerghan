import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GithubAppStateTarget } from './github-app-state.service.js';
import { GithubAppStrategy } from './github-app.strategy.js';
import type { Integration } from '../../entities/integration.entity.js';
import { IntegrationCredentialService } from '../../integration-credential.service.js';
import { flowUnsupported, limitReached } from '../../integration-http-errors.js';
import type { IntegrationResponse } from '../../integration-response.js';
import { IntegrationStoreService } from '../../integration-store.service.js';
import { IntegrationsService, normalizeLabel } from '../../integrations.service.js';
import type { ValidatedCredential } from '../integration-type-strategy.js';

/** A stored GitHub App integration: created (201) or replaced (200). */
export interface GithubAppStored {
  created: boolean;
  integration: IntegrationResponse;
}

/**
 * The create/replace checks and storage shared by the GitHub App's start,
 * callback and select: owner-scoped target lookup, cool-off, cap and label
 * checks, then the generic storage and encryption code.
 */
@Injectable()
export class GithubAppStore {
  private readonly strategy: GithubAppStrategy;
  private readonly store: IntegrationStoreService;
  private readonly credentials: IntegrationCredentialService;
  private readonly integrations: IntegrationsService;

  /**
   * @param {GithubAppStrategy} strategy - The `github_app` strategy (metadata, mask).
   * @param {IntegrationStoreService} store - Owner-scoped persistence.
   * @param {IntegrationCredentialService} credentials - Cool-off and sealing.
   * @param {IntegrationsService} integrations - The per-user cap and the response builder.
   */
  constructor(
    strategy: GithubAppStrategy,
    store: IntegrationStoreService,
    credentials: IntegrationCredentialService,
    integrations: IntegrationsService,
  ) {
    this.strategy = strategy;
    this.store = store;
    this.credentials = credentials;
    this.integrations = integrations;
  }

  /**
   * The checks every step repeats, in the spec's order: replace target owned
   * (404) and of type `github_app` (400) → cool-off (423) → create: cap and
   * label (409).
   * @param {number} userId - The caller's id.
   * @param {GithubAppStateTarget} target - Create (with label) or replace (with target uuid).
   * @returns {Promise<void>} Resolves when the flow may go on.
   */
  async precheck(userId: number, target: GithubAppStateTarget): Promise<void> {
    if (target.purpose === 'replace') {
      this.assertGithubApp(await this.store.findOwned(userId, target.integrationUuid));
    }

    await this.credentials.assertNotLocked(userId);

    if (target.purpose === 'create') {
      await this.assertCreatable(userId, target.label);
    }
  }

  /**
   * Stores a verified installation: create inserts an `active` row within
   * the cap; replace refreshes the owned row like a generic replace
   * credential. Nothing happens on GitHub to a previous installation.
   * @param {number} userId - The caller's id.
   * @param {GithubAppStateTarget} target - Create or replace.
   * @param {ValidatedCredential} validated - The validated installation.
   * @returns {Promise<GithubAppStored>} The created or updated integration.
   */
  async save(userId: number, target: GithubAppStateTarget, validated: ValidatedCredential): Promise<GithubAppStored> {
    if (target.purpose === 'create') {
      return this.create(userId, target.label, validated);
    }

    // Looked up again: the row may have been deleted while GitHub was being called.
    const row = await this.store.findOwned(userId, target.integrationUuid);
    const updated = await this.store.updateOwned(row, this.freshCredentialColumns(validated, row.uuid));

    return { created: false, integration: this.integrations.respond(updated) };
  }

  /**
   * Inserts an `active` row within the per-user cap.
   * @param {number} userId - The caller's id.
   * @param {string} label - The label validated at start.
   * @param {ValidatedCredential} validated - The validated installation.
   * @returns {Promise<GithubAppStored>} The created integration.
   */
  private async create(userId: number, label: string, validated: ValidatedCredential): Promise<GithubAppStored> {
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
   * The columns a successful validation writes: sealed credential and a fresh `active` status.
   * @param {ValidatedCredential} validated - The validated installation.
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
   * Rejects a replace target of another type (changing type means delete and create).
   * @param {Integration} row - The owned row.
   * @returns {void}
   */
  private assertGithubApp(row: Integration): void {
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
