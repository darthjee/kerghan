import { randomBytes, randomUUID } from 'node:crypto';
import { enabledGithubAppConfig } from './github-app-test-config.js';
import { githubAppTestKey } from './github-app-test-key.js';
import { createInMemoryIntegrationRepo, type InMemoryIntegrationRepo } from './in-memory-integrations.js';
import type { FakeLogger } from './integrations-harness.js';
import type { LoggerService } from '../../../core/logger.service.js';
import { FakeClock } from '../../../core/tests/support/fake-clock.js';
import type { Integration } from '../../entities/integration.entity.js';
import { GithubAppRepoCaller } from '../../github-app-repo-caller.js';
import { GithubAuthenticatedRunner } from '../../github-authenticated-runner.js';
import { GithubInstallationTokenCache } from '../../github-installation-token-cache.js';
import { GithubIssueClientService } from '../../github-issue-client.service.js';
import { GithubRepoClientService } from '../../github-repo-client.service.js';
import { GithubUnauthenticatedBudget } from '../../github-unauthenticated-budget.js';
import type { IntegrationStatus, IntegrationType } from '../../integration-enums.js';
import { IntegrationStoreService } from '../../integration-store.service.js';
import { IntegrationsEncryptionService } from '../../integrations-encryption.service.js';
import { IntegrationsGithubIssueWriter } from '../../integrations-github-issue-writer.service.js';
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
/** The GitHub error body every error answer of `github-builders.ts` embeds (`notFound()`, `serverError()`, ...). */
export const CANARY_ERROR_BODY = `${CANARY}BODY`;

/**
 * Recognisable pieces of the GitHub App private key (the test-only RSA key, a valid key since it
 * signs the app JWT): the PEM body line, the DER body in the one-line base64 form the env var holds,
 * and the whole PEM. The key never leaves the Integrations module, so none may be found anywhere else.
 * @returns {string[]} The pieces to search for.
 */
export function canaryAppKey(): string[] {
  const { base64Pem } = githubAppTestKey();
  const pem = Buffer.from(base64Pem, 'base64').toString();
  const bodyLines = pem.split('\n').filter((line) => line.length > 0 && !line.startsWith('-----'));

  return [bodyLines[2], base64Pem.slice(200, 260), pem.trim()];
}
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
  writer: IntegrationsGithubIssueWriter;
  issueClient: GithubIssueClientService;
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

/** The real services over a store, as every harness wires them. */
export interface GithubServices {
  service: IntegrationsGithubService;
  writer: IntegrationsGithubIssueWriter;
  issueClient: GithubIssueClientService;
  client: GithubRepoClientService;
  store: IntegrationStoreService;
  encryption: IntegrationsEncryptionService;
  tokens: GithubInstallationTokenCache;
  budget: GithubUnauthenticatedBudget;
  enabled: EnabledTypes;
}

/**
 * Wires the real `IntegrationsGithubService`, `IntegrationsGithubIssueWriter`, installation-token
 * cache and credential encryption over an integrations repository (the in-memory one, or TypeORM's).
 * @param {unknown} repo - The integrations repository.
 * @param {FakeClock} clock - The time source.
 * @param {unknown} logger - The logger the runner and the App caller write to.
 * @returns {GithubServices} The services.
 */
export function buildGithubServices(repo: unknown, clock: FakeClock, logger: unknown): GithubServices {
  const encryption = new IntegrationsEncryptionService(integrationsKeySetOf(randomBytes(32)));
  const store = new IntegrationStoreService(repo as never);
  const enabled: EnabledTypes = { pat: true, oauth_app: true, github_app: true };
  const registry = new IntegrationTypeRegistry([
    stubStrategy('pat', () => enabled.pat, parsePatPayload),
    stubStrategy('oauth_app', () => enabled.oauth_app, parseOauthAppPayload),
    stubStrategy('github_app', () => enabled.github_app, parseGithubAppPayload),
  ]);
  const client = new GithubRepoClientService(clock);
  const tokens = new GithubInstallationTokenCache(clock, store);
  const budget = new GithubUnauthenticatedBudget(clock);
  const log = logger as LoggerService;
  const githubApp = new GithubAppRepoCaller(client, tokens, store, clock, log, enabledGithubAppConfig());
  const issueClient = new GithubIssueClientService(clock);
  const runner = new GithubAuthenticatedRunner(store, encryption, registry, githubApp, clock, log);

  return {
    service: new IntegrationsGithubService(store, runner, client, issueClient, budget, clock),
    writer: new IntegrationsGithubIssueWriter(runner, issueClient),
    issueClient, client, store, encryption, tokens, budget, enabled,
  };
}

/**
 * The row of one seeded integration, its credential really encrypted.
 * @param {IntegrationsEncryptionService} encryption - The encryption.
 * @param {SeedOptions} options - What to seed.
 * @param {number} ordinal - The 1-based position of this seed (label and `created_at` default).
 * @returns {Integration} The unsaved row.
 */
export function integrationRowOf(encryption: IntegrationsEncryptionService, options: SeedOptions, ordinal: number): Integration {
  const type = options.type ?? 'pat';
  const uuid = randomUUID();
  const label = options.label ?? `integration ${ordinal}`;
  const encrypted = encryption.encrypt(payloadFor(type, options), { uuid, type });

  return {
    uuid,
    userId: options.userId ?? 1,
    provider: 'github',
    type,
    label,
    labelNormalized: label,
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
    createdAt: options.createdAt ?? new Date(START.getTime() + ordinal * 1000),
  } as Integration;
}

/**
 * The credential payload of a seeded integration: the installation for a GitHub App, a canary token otherwise.
 * @param {IntegrationType} type - The type.
 * @param {SeedOptions} options - What to seed.
 * @returns {Secret} The payload.
 */
function payloadFor(type: IntegrationType, options: SeedOptions): Secret {
  if (type === 'github_app') return new Secret({ installationId: options.installationId ?? 4242 });

  return new Secret({ token: options.token ?? (type === 'pat' ? CANARY_PAT : CANARY_OAUTH_TOKEN) });
}

/**
 * Builds the harness. Call `installNoNetworkGuard()` in the spec too.
 * @returns {GithubServiceHarness} The harness.
 */
export function buildGithubServiceHarness(): GithubServiceHarness {
  const repo = createInMemoryIntegrationRepo();
  const clock = new FakeClock(START);
  const logger: FakeLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const services = buildGithubServices(repo, clock, logger);
  const { encryption } = services;
  let seeded = 0;

  return {
    ...services, repo, clock, logger,
    async seed(options = {}) {
      seeded += 1;
      const row = await repo.save(integrationRowOf(encryption, options, seeded));

      return repo.rows.find((candidate) => candidate.id === row.id) as Integration;
    },
    replace(row, token) {
      const stored = repo.rows.find((candidate) => candidate.id === row.id) as Integration;
      const type = stored.type as IntegrationType;
      const encrypted = encryption.encrypt(payloadFor(type, { token, installationId: 4242 }), { uuid: stored.uuid, type });

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
