import { Injectable, NotFoundException } from '@nestjs/common';
import type { EnabledGithubAppConfig } from './github-app-config.js';
import { GITHUB_APP_MAX_CANDIDATES, GithubAppStateService, GithubAppStateTarget } from './github-app-state.service.js';
import { GithubAppStore, GithubAppStored } from './github-app-store.js';
import { GithubAppStrategy } from './github-app.strategy.js';
import type { GithubAccountType, GithubUserInstallation } from '../../github-app-client.service.js';
import { IntegrationCredentialService } from '../../integration-credential.service.js';
import { InstallationNotAccessibleError } from '../../integration-errors.js';

/** One installation offered to the user. */
export interface GithubAppSelectionEntry {
  installationId: number;
  accountLogin: string;
  accountType: GithubAccountType;
}

/** The selection a connect-mode callback answers when several installations are accessible. */
export interface GithubAppSelection {
  state: string;
  installations: GithubAppSelectionEntry[];
}

/** The select body. */
export interface GithubAppSelectInput {
  state: string;
  installationId: number;
}

/**
 * The GitHub App selection (spec *Selection*): builds the list a connect
 * callback answers (sorted by login, case-insensitively, deduplicated, at
 * most 100) with a new single-use `select` state recording the ownership
 * check's result, and completes `POST /integrations/github_app/select.json`.
 */
@Injectable()
export class GithubAppSelectionService {
  private readonly strategy: GithubAppStrategy;
  private readonly states: GithubAppStateService;
  private readonly appStore: GithubAppStore;
  private readonly credentials: IntegrationCredentialService;

  /**
   * @param {GithubAppStrategy} strategy - The `github_app` strategy (config, installation checks).
   * @param {GithubAppStateService} states - Issues and consumes `select` states.
   * @param {GithubAppStore} appStore - The shared prechecks and storage.
   * @param {IntegrationCredentialService} credentials - The failure cool-off.
   */
  constructor(
    strategy: GithubAppStrategy,
    states: GithubAppStateService,
    appStore: GithubAppStore,
    credentials: IntegrationCredentialService,
  ) {
    this.strategy = strategy;
    this.states = states;
    this.appStore = appStore;
    this.credentials = credentials;
  }

  /**
   * Builds the selection and its `select` state.
   * @param {number} userId - The caller's id.
   * @param {GithubAppStateTarget} target - The consumed `redirect` row's target.
   * @param {GithubUserInstallation[]} installations - The verified installations of this app.
   * @param {string} verifiedBy - The GitHub login that proved access.
   * @returns {Promise<GithubAppSelection>} The selection.
   */
  async offer(
    userId: number,
    target: GithubAppStateTarget,
    installations: GithubUserInstallation[],
    verifiedBy: string,
  ): Promise<GithubAppSelection> {
    const entries = selectionEntries(installations);
    const state = await this.states.issueSelect(
      userId,
      target,
      entries.map((entry) => entry.installationId),
      verifiedBy,
    );

    return { state, installations: entries };
  }

  /**
   * Completes a selection. Checks, in order: type enabled (404) → `select`
   * state (400) → replace target owned (404) → cool-off (423) → create: cap
   * and label (409) → id among the candidates (422, counted) → installation
   * checks (counted) → store.
   * @param {number} userId - The caller's id.
   * @param {GithubAppSelectInput} input - The validated body.
   * @returns {Promise<GithubAppStored>} The created or updated integration.
   */
  async select(userId: number, input: GithubAppSelectInput): Promise<GithubAppStored> {
    const config = this.enabledConfig();
    const consumed = await this.states.consume(userId, input.state, 'select');

    await this.appStore.precheck(userId, consumed.target);

    const validated = await this.credentials.attempt(userId, async () => {
      if (!consumed.candidates.includes(input.installationId)) {
        throw new InstallationNotAccessibleError();
      }

      return this.strategy.validateInstallation(config, input.installationId, consumed.verifiedBy as string);
    });

    return this.appStore.save(userId, consumed.target, validated);
  }

  /**
   * The enabled config; a disabled type answers 404 as if the route didn't exist.
   * @returns {EnabledGithubAppConfig} The config.
   */
  private enabledConfig(): EnabledGithubAppConfig {
    const config = this.strategy.enabledConfig();

    if (config === null) {
      throw new NotFoundException();
    }

    return config;
  }
}

/**
 * Sorts (by login, case-insensitively, then id), deduplicates and caps the installations.
 * @param {GithubUserInstallation[]} installations - The verified installations.
 * @returns {GithubAppSelectionEntry[]} At most 100 entries.
 */
export function selectionEntries(installations: GithubUserInstallation[]): GithubAppSelectionEntry[] {
  const unique = new Map<number, GithubAppSelectionEntry>();

  installations.forEach(({ installationId, accountLogin, accountType }) => {
    if (!unique.has(installationId)) {
      unique.set(installationId, { installationId, accountLogin, accountType });
    }
  });

  return [...unique.values()]
    .sort((a, b) => a.accountLogin.toLowerCase().localeCompare(b.accountLogin.toLowerCase())
      || a.installationId - b.installationId)
    .slice(0, GITHUB_APP_MAX_CANDIDATES);
}
