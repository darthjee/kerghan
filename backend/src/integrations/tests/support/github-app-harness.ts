import { githubAppExchangeResponse } from './fake-github-answers.js';
import { enabledGithubAppConfig } from './github-app-test-config.js';
import { createInMemoryGithubAppStateRepo, InMemoryGithubAppStateRepo } from './in-memory-github-app-states.js';
import { buildIntegrationsHarness, IntegrationsHarness } from './integrations-harness.js';
import type { LoggerService } from '../../../core/logger.service.js';
import type { GithubAppClientService } from '../../github-app-client.service.js';
import type { GithubClientService } from '../../github-client.service.js';
import type { GithubAppConfig } from '../../types/github-app/github-app-config.js';
import { GithubAppFlowService } from '../../types/github-app/github-app-flow.service.js';
import { GithubAppInstallationService } from '../../types/github-app/github-app-installation.service.js';
import { GithubAppRevocationService } from '../../types/github-app/github-app-revocation.service.js';
import { GithubAppSelectionService } from '../../types/github-app/github-app-selection.service.js';
import { GithubAppStateService } from '../../types/github-app/github-app-state.service.js';
import { GithubAppStore } from '../../types/github-app/github-app-store.js';
import { GithubAppUserVerificationService } from '../../types/github-app/github-app-user-verification.service.js';
import { GithubAppStrategy } from '../../types/github-app/github-app.strategy.js';

/** The GitHub App flow over the shared Integrations harness and an in-memory state table. */
export interface GithubAppHarness extends IntegrationsHarness {
  strategy: GithubAppStrategy;
  flow: GithubAppFlowService;
  selection: GithubAppSelectionService;
  states: InMemoryGithubAppStateRepo;
}

/**
 * Builds the `github_app` strategy over a fake GitHub client.
 * @param {object} github - The fake client (both client services).
 * @param {object} logger - The fake logger.
 * @param {GithubAppConfig} config - The server config.
 * @returns {GithubAppStrategy} The strategy.
 */
export function buildGithubAppStrategy(github: unknown, logger: unknown, config: GithubAppConfig): GithubAppStrategy {
  const client = github as GithubClientService;
  const appClient = github as GithubAppClientService;
  const log = logger as LoggerService;
  const revocation = new GithubAppRevocationService(client, log, config);

  return new GithubAppStrategy(
    new GithubAppUserVerificationService(client, appClient, revocation, log),
    new GithubAppInstallationService(appClient, log),
    config,
  );
}

/**
 * Wires the GitHub App flow services over the shared harness. The fake
 * client's exchange answers the canary `ghu_` user token by default.
 * @param {GithubAppConfig} [config] - The server config.
 * @param {object} [options] - Harness overrides.
 * @param {number} [options.maxPerUser] - The per-user cap.
 * @param {number} [options.maxAttempts] - The cool-off threshold.
 * @returns {GithubAppHarness} The flow and its collaborators.
 */
export function buildGithubAppHarness(
  config: GithubAppConfig = enabledGithubAppConfig(),
  options: { maxPerUser?: number; maxAttempts?: number } = {},
): GithubAppHarness {
  const harness = buildIntegrationsHarness({ maxPerUser: options.maxPerUser, maxAttempts: options.maxAttempts ?? 3 });
  harness.github.exchangeRespondByDefault(githubAppExchangeResponse());
  const strategy = buildGithubAppStrategy(harness.github, harness.logger, config);
  const states = createInMemoryGithubAppStateRepo();
  const stateService = new GithubAppStateService(states as never);
  const appStore = new GithubAppStore(strategy, harness.store, harness.credentials, harness.service);
  const selection = new GithubAppSelectionService(strategy, stateService, appStore, harness.credentials);
  const flow = new GithubAppFlowService(strategy, stateService, appStore, harness.credentials, selection);

  return { ...harness, strategy, flow, selection, states };
}
