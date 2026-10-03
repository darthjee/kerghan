import { Injectable, NotFoundException } from '@nestjs/common';
import type { EnabledGithubAppConfig } from './github-app-config.js';
import { GithubAppSelection, GithubAppSelectionService } from './github-app-selection.service.js';
import { GithubAppStateService, GithubAppStateTarget } from './github-app-state.service.js';
import { GithubAppStore, GithubAppStored } from './github-app-store.js';
import { githubAppRedirectUrl, GithubAppMode } from './github-app-urls.js';
import type { VerifiedGithubUser } from './github-app-user-verification.service.js';
import { GithubAppStrategy } from './github-app.strategy.js';
import type { GithubUserInstallation } from '../../github-app-client.service.js';
import { IntegrationCredentialService } from '../../integration-credential.service.js';
import { InstallationNotAccessibleError } from '../../integration-errors.js';
import { Secret } from '../../secret.js';
import type { ValidatedCredential } from '../integration-type-strategy.js';
import { exactlyOneTarget } from '../oauth-app/oauth-app-flow.service.js';

/** The start body. */
export interface GithubAppStartInput {
  label?: string;
  integrationId?: string;
  mode?: GithubAppMode;
}

/** The callback body. */
export interface GithubAppCallbackInput {
  code: string;
  state: string;
  installationId?: number;
  setupAction?: 'install' | 'update';
}

/** What the callback produced: a stored integration, or a selection to pick from. */
export type GithubAppCallbackResult =
  | ({ kind: 'stored' } & GithubAppStored)
  | { kind: 'selection'; selection: GithubAppSelection };

/** What the verification half of the callback decided, inside the cool-off attempt. */
type Verified =
  | { kind: 'validated'; validated: ValidatedCredential }
  | { kind: 'several'; user: VerifiedGithubUser };

/**
 * The GitHub App flow (see `docs/agents/specs/integrations/types/github-app.md#flow`):
 * `start` checks the request and answers the install or authorize URL (no
 * GitHub call, never counted); `callback` consumes the single-use `redirect`
 * state, proves which installations the user can access with a short-lived
 * user token, picks the claimed (or only) one, checks it with the app JWT
 * and stores it — or answers a selection when connect mode finds several.
 */
@Injectable()
export class GithubAppFlowService {
  private readonly strategy: GithubAppStrategy;
  private readonly states: GithubAppStateService;
  private readonly appStore: GithubAppStore;
  private readonly credentials: IntegrationCredentialService;
  private readonly selection: GithubAppSelectionService;

  /**
   * @param {GithubAppStrategy} strategy - The `github_app` strategy (config, verification).
   * @param {GithubAppStateService} states - Issues and consumes the flow's `state`.
   * @param {GithubAppStore} appStore - The shared prechecks and storage.
   * @param {IntegrationCredentialService} credentials - The failure cool-off.
   * @param {GithubAppSelectionService} selection - Builds the connect-mode selection.
   */
  constructor(
    strategy: GithubAppStrategy,
    states: GithubAppStateService,
    appStore: GithubAppStore,
    credentials: IntegrationCredentialService,
    selection: GithubAppSelectionService,
  ) {
    this.strategy = strategy;
    this.states = states;
    this.appStore = appStore;
    this.credentials = credentials;
    this.selection = selection;
  }

  /**
   * Starts a flow. Checks, in order: type enabled (404) → exactly one of
   * `label`/`integrationId` (400) → replace target owned (404) and of type
   * `github_app` (400) → cool-off (423) → create: cap and label (409). Then
   * stores a `redirect` state and answers the URL for the mode.
   * @param {number} userId - The caller's id.
   * @param {GithubAppStartInput} input - The validated body.
   * @returns {Promise<{ redirectUrl: string }>} Where to send the browser.
   */
  async start(userId: number, input: GithubAppStartInput): Promise<{ redirectUrl: string }> {
    const config = this.enabledConfig();
    const chosen = exactlyOneTarget(input);
    const target: GithubAppStateTarget = 'label' in chosen
      ? { purpose: 'create', label: chosen.label }
      : { purpose: 'replace', integrationUuid: chosen.integrationUuid };

    await this.appStore.precheck(userId, target);

    const state = await this.states.issueRedirect(userId, target);

    return { redirectUrl: githubAppRedirectUrl(config, input.mode ?? 'install', state) };
  }

  /**
   * Completes the redirect. Checks, in order: type enabled (404) → `redirect`
   * state (400) → replace target owned (404) → cool-off (423) → create: cap
   * and label (409) → ownership check, installation pick and installation
   * checks (counted like a pasted credential) → store, or a selection.
   * @param {number} userId - The caller's id.
   * @param {GithubAppCallbackInput} input - The validated body.
   * @returns {Promise<GithubAppCallbackResult>} The stored integration or the selection.
   */
  async callback(userId: number, input: GithubAppCallbackInput): Promise<GithubAppCallbackResult> {
    const config = this.enabledConfig();
    const { target } = await this.states.consume(userId, input.state, 'redirect');

    await this.appStore.precheck(userId, target);

    const verified = await this.credentials.attempt(
      userId,
      () => this.verify(config, userId, input),
      (result) => result.kind === 'validated',
    );

    if (verified.kind === 'several') {
      const { installations, login } = verified.user;

      return { kind: 'selection', selection: await this.selection.offer(userId, target, installations, login) };
    }

    return { kind: 'stored', ...await this.appStore.save(userId, target, verified.validated) };
  }

  /**
   * Proves access, picks the installation and checks it (spec callback steps 8–11).
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {number} userId - The caller's id.
   * @param {GithubAppCallbackInput} input - The validated body.
   * @returns {Promise<Verified>} The validated installation, or several to choose from.
   */
  private async verify(config: EnabledGithubAppConfig, userId: number, input: GithubAppCallbackInput): Promise<Verified> {
    const user = await this.strategy.verifyUser(config, new Secret(input.code), userId);
    const picked = pickInstallation(user.installations, input.installationId);

    if (picked === null) {
      return { kind: 'several', user };
    }

    return { kind: 'validated', validated: await this.strategy.validateInstallation(config, picked, user.login) };
  }

  /**
   * The enabled config; a disabled type answers 404 as if the routes didn't exist.
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
 * Picks the installation (spec callback step 10): a claimed id must be among
 * the verified ones; without a claim, none fails, one is taken, several
 * answer `null` (a selection). The same error whether the id doesn't exist,
 * is someone else's or another app's.
 * @param {GithubUserInstallation[]} installations - The verified installations of this app.
 * @param {number | undefined} claimed - The `installationId` GitHub's redirect carried.
 * @returns {number | null} The installation id, or `null` for a selection.
 */
export function pickInstallation(installations: GithubUserInstallation[], claimed: number | undefined): number | null {
  if (claimed !== undefined) {
    if (!installations.some((installation) => installation.installationId === claimed)) {
      throw new InstallationNotAccessibleError();
    }

    return claimed;
  }

  if (installations.length === 0) {
    throw new InstallationNotAccessibleError();
  }

  return installations.length === 1 ? installations[0].installationId : null;
}
