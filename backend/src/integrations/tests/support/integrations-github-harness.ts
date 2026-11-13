import { randomBytes, randomUUID } from 'node:crypto';
import { enabledGithubAppConfig } from './github-app-test-config.js';
import { createInMemoryIntegrationRepo, type InMemoryIntegrationRepo } from './in-memory-integrations.js';
import type { FakeLogger } from './integrations-harness.js';
import type { LoggerService } from '../../../core/logger.service.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import type { Integration } from '../../entities/integration.entity.js';
import { GithubAppRepoCaller } from '../../github-app-repo-caller.js';
import { GithubInstallationTokenCache } from '../../github-installation-token-cache.js';
import { GithubRepoClientService } from '../../github-repo-client.service.js';
import { GithubUnauthenticatedBudget } from '../../github-unauthenticated-budget.js';
import type { IntegrationStatus, IntegrationType } from '../../integration-enums.js';
import { IntegrationStoreService } from '../../integration-store.service.js';
import { IntegrationsEncryptionService } from '../../integrations-encryption.service.js';
import { IntegrationsGithubService } from '../../integrations-github.service.js';
import { integrationsKeySetOf } from '../../integrations-key.js';
import { Secret } from '../../secret.js';
import { parseGithubAppPayload } from '../../types/github-app/github-app-credential.js';
import { IntegrationTypeRegistry } from '../../types/integration-type-registry.js';
import type { IntegrationTypeStrategy } from '../../types/integration-type-strategy.js';
import { parseOauthAppPayload } from '../../types/oauth-app/oauth-app-credential.js';
import { parsePatPayload } from '../../types/pat/pat-credential.js';

/** A PAT canary: must never leave the module. */
export const CANARY_PAT = 'ghp_CANARYcanaryPAT0000000000000000000a1b2';
/** An OAuth App token canary. */
export const CANARY_OAUTH_TOKEN = 'gho_CANARYcanaryOAUTH00000000000000000c3d4';
/** A minted installation token canary. */
export const CANARY_INSTALLATION_TOKEN = 'ghs_CANARYcanaryINSTALLATION000000000e5f6';
/** The fragment every canary carries. */
export const CANARY = 'CANARYcanary';
/** The start of the `FakeClock`. */
export const START = new Date('2026-01-01T00:00:00Z');

/** Which types the harness's registry reports enabled. */
export type EnabledTypes = Record<IntegrationType, boolean>;

/** How to seed one integration. */
export interface SeedOptions {
  userId?: number;
  type?: IntegrationType;
  token?: string;
  installationId?: number;
  status?: IntegrationStatus;
  createdAt?: Date;
  expiresAt?: Date | null;
  label?: string;
}

/** The real `IntegrationsGithubService` over in-memory doubles, `FakeClock` and the guarded `fetch`. */
export interface GithubServiceHarness {
  service: IntegrationsGithubService;
  client: GithubRepoClientService;
  repo: InMemoryIntegrationRepo;
  store: IntegrationStoreService;
  encryption: IntegrationsEncryptionService;
  tokens: GithubInstallationTokenCache;
  budget: GithubUnauthenticatedBudget;
  clock: FakeClock;
  logger: FakeLogger;
  enabled: EnabledTypes;
  seed(options?: SeedOptions): Promise<Integration>;
  /** Re-encrypts a row's credential (a fresh `secret_iv`), as a Replace does. */
  replace(row: Integration, token?: string): void;
}

/**
 * Builds the harness. Call `installNoNetworkGuard()` in the spec too.
 * @returns {GithubServiceHarness} The harness.
 */
export function buildGithubServiceHarness(): GithubServiceHarness {
  const encryption = new IntegrationsEncryptionService(integrationsKeySetOf(randomBytes(32)));
  const repo = createInMemoryIntegrationRepo();
  const store = new IntegrationStoreService(repo as never);
  const clock = new FakeClock(START);
  const logger: FakeLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const enabled: EnabledTypes = { pat: true, oauth_app: true, github_app: true };
  const registry = new IntegrationTypeRegistry([
    stubStrategy('pat', () => enabled.pat, parsePatPayload),
    stubStrategy('oauth_app', () => enabled.oauth_app, parseOauthAppPayload),
    stubStrategy('github_app', () => enabled.github_app, parseGithubAppPayload),
  ]);
  const client = new GithubRepoClientService(clock);
  const tokens = new GithubInstallationTokenCache(clock, store);
  const budget = new GithubUnauthenticatedBudget(clock);
  const githubApp = new GithubAppRepoCaller(client, tokens, store, clock, logger as unknown as LoggerService,
    enabledGithubAppConfig());
  const service = new IntegrationsGithubService(store, encryption, registry, client, githubApp, budget, clock,
    logger as unknown as LoggerService);
  const payloadOf = (type: IntegrationType, options: SeedOptions): Secret => (type === 'github_app'
    ? new Secret({ installationId: options.installationId ?? 4242 })
    : new Secret({ token: options.token ?? (type === 'pat' ? CANARY_PAT : CANARY_OAUTH_TOKEN) }));

  let seeded = 0;

  return {
    service, client, repo, store, encryption, tokens, budget, clock, logger, enabled,
    async seed(options = {}) {
      seeded += 1;
      const type = options.type ?? 'pat';
      const uuid = randomUUID();
      const encrypted = encryption.encrypt(payloadOf(type, options), { uuid, type });
      const row = await repo.save({
        uuid,
        userId: options.userId ?? 1,
        provider: 'github',
        type,
        label: options.label ?? `integration ${seeded}`,
        labelNormalized: `integration ${seeded}`,
        status: options.status ?? 'active',
        statusReason: null,
        githubLogin: 'octocat',
        expiresAt: options.expiresAt ?? null,
        lastTestedAt: null,
        lastTestResult: null,
        metadata: {},
        secretHint: null,
        secretKeyId: encrypted.keyId,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        secretCiphertext: encrypted.ciphertext,
        createdAt: options.createdAt ?? new Date(START.getTime() + seeded * 1000),
      } as Integration);

      return repo.rows.find((candidate) => candidate.id === row.id) as Integration;
    },
    replace(row, token) {
      const stored = repo.rows.find((candidate) => candidate.id === row.id) as Integration;
      const type = stored.type as IntegrationType;
      const encrypted = encryption.encrypt(payloadOf(type, { token, installationId: 4242 }), { uuid: stored.uuid, type });

      Object.assign(stored, {
        secretKeyId: encrypted.keyId,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        secretCiphertext: encrypted.ciphertext,
        status: 'active',
        statusReason: null,
      });
    },
  };
}

/**
 * A strategy stub carrying only what `IntegrationsGithubService` reads.
 * @param {IntegrationType} type - The type.
 * @param {() => boolean} isEnabled - Whether it is enabled.
 * @param {(payload: Secret) => Secret | null} parseSecretPayload - The payload re-validation.
 * @returns {IntegrationTypeStrategy} The stub.
 */
function stubStrategy(
  type: IntegrationType,
  isEnabled: () => boolean,
  parseSecretPayload: (payload: Secret) => Secret | null,
): IntegrationTypeStrategy {
  return { type, isEnabled, parseSecretPayload } as unknown as IntegrationTypeStrategy;
}
