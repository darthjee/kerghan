import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationCredentialLockout } from './entities/integration-credential-lockout.entity.js';
import { Integration } from './entities/integration.entity.js';
import { GithubClientService } from './github-client.service.js';
import { IntegrationConnectionTestService } from './integration-connection-test.service.js';
import { IntegrationCredentialAbuseGuardService } from './integration-credential-abuse-guard.service.js';
import { IntegrationCredentialService } from './integration-credential.service.js';
import { IntegrationStoreService } from './integration-store.service.js';
import { IntegrationTestCooldownService } from './integration-test-cooldown.service.js';
import { IntegrationsEncryptionService } from './integrations-encryption.service.js';
import { buildIntegrationsKey, INTEGRATIONS_KEY } from './integrations-key.js';
import { IntegrationsController } from './integrations.controller.js';
import { IntegrationsService } from './integrations.service.js';
import { IntegrationTypeRegistry } from './types/integration-type-registry.js';
import { INTEGRATION_TYPE_STRATEGIES, IntegrationTypeStrategy } from './types/integration-type-strategy.js';
import { PatStrategy } from './types/pat/pat.strategy.js';

/**
 * The Integrations module — always-on (imported directly into `AppModule`):
 * labelled, encrypted GitHub credentials owned by one user each (see
 * `docs/agents/specs/integrations/`). Owns tables `integrations` and
 * `integrations_credential_lockouts`; `integrations.user_id` carries the
 * project's only physical cross-module FK (`ON DELETE CASCADE` to
 * `auth_users`), declared in its migration only. Exports nothing yet.
 *
 * `KERGHAN_INTEGRATIONS_KEY` is validated once, in the `INTEGRATIONS_KEY`
 * factory, so a missing or malformed key fails Nest's boot. Strategies are
 * registered, in registry order, in `INTEGRATION_TYPE_STRATEGIES`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Integration, IntegrationCredentialLockout])],
  controllers: [IntegrationsController],
  providers: [
    {
      provide: INTEGRATIONS_KEY,
      inject: [ConfigService],
      useFactory: buildIntegrationsKey,
    },
    {
      provide: INTEGRATION_TYPE_STRATEGIES,
      inject: [PatStrategy],
      useFactory: (pat: PatStrategy): IntegrationTypeStrategy[] => [pat],
    },
    IntegrationsEncryptionService,
    GithubClientService,
    IntegrationTypeRegistry,
    PatStrategy,
    IntegrationCredentialAbuseGuardService,
    IntegrationTestCooldownService,
    IntegrationStoreService,
    IntegrationCredentialService,
    IntegrationConnectionTestService,
    IntegrationsService,
  ],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IntegrationsModule {}
