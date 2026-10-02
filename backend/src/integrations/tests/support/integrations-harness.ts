import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { FakeGithubClient } from './fake-github-client.js';
import {
  createInMemoryIntegrationRepo,
  InMemoryCredentialAbuseGuard,
  InMemoryIntegrationRepo,
  InMemoryTestCooldown,
} from './in-memory-integrations.js';
import type { LoggerService } from '../../../core/logger.service.js';
import type { GithubClientService } from '../../github-client.service.js';
import { IntegrationConnectionTestService } from '../../integration-connection-test.service.js';
import type { IntegrationCredentialAbuseGuardService } from '../../integration-credential-abuse-guard.service.js';
import { IntegrationCredentialService } from '../../integration-credential.service.js';
import { IntegrationStoreService } from '../../integration-store.service.js';
import type { IntegrationTestCooldownService } from '../../integration-test-cooldown.service.js';
import { IntegrationsEncryptionService } from '../../integrations-encryption.service.js';
import { integrationsKeyIdFor } from '../../integrations-key.js';
import { IntegrationsService } from '../../integrations.service.js';
import { IntegrationTypeRegistry } from '../../types/integration-type-registry.js';
import { PatStrategy } from '../../types/pat/pat.strategy.js';

/** A recognisable classic token that must never leak anywhere. */
export const CANARY_CLASSIC = 'ghp_CANARYcanaryCANARY00000000000000a1b2';
/** A recognisable fine-grained token that must never leak anywhere. */
export const CANARY_FINE = 'github_pat_CANARYcanaryCANARY0000000000c3d4';
/** The fragment searched for in logs, errors and responses. */
export const CANARY_FRAGMENT = 'CANARYcanary';

export interface FakeLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

export interface IntegrationsHarness {
  service: IntegrationsService;
  store: IntegrationStoreService;
  credentials: IntegrationCredentialService;
  repo: InMemoryIntegrationRepo;
  github: FakeGithubClient;
  guard: InMemoryCredentialAbuseGuard;
  cooldown: InMemoryTestCooldown;
  encryption: IntegrationsEncryptionService;
  logger: FakeLogger;
}

export interface HarnessOptions {
  maxPerUser?: number;
  maxAttempts?: number;
  cooldownMs?: number;
}

/**
 * Wires the real Integrations services over in-memory doubles (repository,
 * cool-off, cooldown) and the fake GitHub client.
 * @param {HarnessOptions} options - Config overrides.
 * @returns {IntegrationsHarness} The service and its collaborators.
 */
export function buildIntegrationsHarness(options: HarnessOptions = {}): IntegrationsHarness {
  const key = randomBytes(32);
  const encryption = new IntegrationsEncryptionService({ key, keyId: integrationsKeyIdFor(key) });
  const repo = createInMemoryIntegrationRepo();
  const github = new FakeGithubClient();
  const guard = new InMemoryCredentialAbuseGuard(options.maxAttempts);
  const cooldown = new InMemoryTestCooldown(repo, options.cooldownMs);
  const logger: FakeLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const pat = new PatStrategy(github as unknown as GithubClientService, logger as unknown as LoggerService);
  const registry = new IntegrationTypeRegistry([pat]);
  const store = new IntegrationStoreService(repo as never);
  const credentials = new IntegrationCredentialService(
    registry,
    guard as unknown as IntegrationCredentialAbuseGuardService,
    encryption,
  );
  const connectionTest = new IntegrationConnectionTestService(
    store,
    cooldown as unknown as IntegrationTestCooldownService,
    encryption,
    registry,
  );
  const config = { get: (name: string) => (name === 'KERGHAN_INTEGRATIONS_MAX_PER_USER' ? options.maxPerUser : undefined) };
  const service = new IntegrationsService(
    store,
    credentials,
    connectionTest,
    cooldown as unknown as IntegrationTestCooldownService,
    encryption,
    registry,
    logger as unknown as LoggerService,
    config as unknown as ConfigService,
  );

  return { service, store, credentials, repo, github, guard, cooldown, encryption, logger };
}
