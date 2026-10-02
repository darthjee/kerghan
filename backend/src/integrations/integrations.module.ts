import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationCredentialLockout } from './entities/integration-credential-lockout.entity.js';
import { IntegrationOauthState } from './entities/integration-oauth-state.entity.js';
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
import { OauthAppCodeExchangeService } from './types/oauth-app/oauth-app-code-exchange.service.js';
import { buildOauthAppConfig, OAUTH_APP_CONFIG } from './types/oauth-app/oauth-app-config.js';
import { OauthAppEnabledGuard } from './types/oauth-app/oauth-app-enabled.guard.js';
import { OauthAppFlowService } from './types/oauth-app/oauth-app-flow.service.js';
import { OauthAppRevocationService } from './types/oauth-app/oauth-app-revocation.service.js';
import { OauthAppController } from './types/oauth-app/oauth-app.controller.js';
import { OauthAppStrategy } from './types/oauth-app/oauth-app.strategy.js';
import { OauthStateService } from './types/oauth-app/oauth-state.service.js';
import { PatStrategy } from './types/pat/pat.strategy.js';

/**
 * The Integrations module — always-on (imported directly into `AppModule`):
 * labelled, encrypted GitHub credentials owned by one user each (see
 * `docs/agents/specs/integrations/`). Owns tables `integrations`,
 * `integrations_credential_lockouts` and `integrations_oauth_states`;
 * `integrations.user_id` carries the project's only physical cross-module FK (`ON DELETE CASCADE` to
 * `auth_users`), declared in its migration only. Exports nothing yet.
 *
 * `KERGHAN_INTEGRATIONS_KEY` is validated once, in the `INTEGRATIONS_KEY`
 * factory, so a missing or malformed key fails Nest's boot. The optional
 * OAuth App config is validated once, in the `OAUTH_APP_CONFIG` factory. Strategies are
 * registered, in registry order, in `INTEGRATION_TYPE_STRATEGIES`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Integration, IntegrationCredentialLockout, IntegrationOauthState])],
  controllers: [OauthAppController, IntegrationsController],
  providers: [
    {
      provide: INTEGRATIONS_KEY,
      inject: [ConfigService],
      useFactory: buildIntegrationsKey,
    },
    {
      provide: OAUTH_APP_CONFIG,
      inject: [ConfigService],
      useFactory: buildOauthAppConfig,
    },
    {
      provide: INTEGRATION_TYPE_STRATEGIES,
      inject: [PatStrategy, OauthAppStrategy],
      useFactory: (pat: PatStrategy, oauthApp: OauthAppStrategy): IntegrationTypeStrategy[] => [pat, oauthApp],
    },
    IntegrationsEncryptionService,
    GithubClientService,
    IntegrationTypeRegistry,
    PatStrategy,
    OauthAppRevocationService,
    OauthAppCodeExchangeService,
    OauthAppStrategy,
    IntegrationCredentialAbuseGuardService,
    IntegrationTestCooldownService,
    IntegrationStoreService,
    IntegrationCredentialService,
    IntegrationConnectionTestService,
    IntegrationsService,
    OauthStateService,
    OauthAppEnabledGuard,
    OauthAppFlowService,
  ],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IntegrationsModule {}
