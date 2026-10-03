import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationCredentialLockout } from './entities/integration-credential-lockout.entity.js';
import { IntegrationGithubAppState } from './entities/integration-github-app-state.entity.js';
import { IntegrationOauthState } from './entities/integration-oauth-state.entity.js';
import { Integration } from './entities/integration.entity.js';
import { GithubAppClientService } from './github-app-client.service.js';
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
import { buildGithubAppConfig, GITHUB_APP_CONFIG } from './types/github-app/github-app-config.js';
import { GithubAppFlowService } from './types/github-app/github-app-flow.service.js';
import { GithubAppInstallationService } from './types/github-app/github-app-installation.service.js';
import { GithubAppRevocationService } from './types/github-app/github-app-revocation.service.js';
import { GithubAppSelectionService } from './types/github-app/github-app-selection.service.js';
import { GithubAppStateService } from './types/github-app/github-app-state.service.js';
import { GithubAppStore } from './types/github-app/github-app-store.js';
import { GithubAppUserVerificationService } from './types/github-app/github-app-user-verification.service.js';
import { GithubAppStrategy } from './types/github-app/github-app.strategy.js';
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
 * `integrations_credential_lockouts`, `integrations_oauth_states` and
 * `integrations_github_app_states`;
 * `integrations.user_id` carries the project's only physical cross-module FK (`ON DELETE CASCADE` to
 * `auth_users`), declared in its migration only. Exports nothing yet.
 *
 * `KERGHAN_INTEGRATIONS_KEY` is validated once, in the `INTEGRATIONS_KEY`
 * factory, so a missing or malformed key fails Nest's boot. The optional
 * OAuth App and GitHub App configs are validated once, in the
 * `OAUTH_APP_CONFIG` and `GITHUB_APP_CONFIG` factories. Strategies are
 * registered, in registry order, in `INTEGRATION_TYPE_STRATEGIES`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([
    Integration,
    IntegrationCredentialLockout,
    IntegrationOauthState,
    IntegrationGithubAppState,
  ])],
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
      provide: GITHUB_APP_CONFIG,
      inject: [ConfigService],
      useFactory: buildGithubAppConfig,
    },
    {
      provide: INTEGRATION_TYPE_STRATEGIES,
      inject: [PatStrategy, OauthAppStrategy, GithubAppStrategy],
      useFactory: (pat: PatStrategy, oauthApp: OauthAppStrategy, githubApp: GithubAppStrategy): IntegrationTypeStrategy[] =>
        [pat, oauthApp, githubApp],
    },
    IntegrationsEncryptionService,
    GithubClientService,
    IntegrationTypeRegistry,
    PatStrategy,
    OauthAppRevocationService,
    OauthAppCodeExchangeService,
    OauthAppStrategy,
    GithubAppClientService,
    GithubAppRevocationService,
    GithubAppUserVerificationService,
    GithubAppInstallationService,
    GithubAppStrategy,
    IntegrationCredentialAbuseGuardService,
    IntegrationTestCooldownService,
    IntegrationStoreService,
    IntegrationCredentialService,
    IntegrationConnectionTestService,
    IntegrationsService,
    OauthStateService,
    OauthAppEnabledGuard,
    OauthAppFlowService,
    GithubAppStateService,
    GithubAppStore,
    GithubAppSelectionService,
    GithubAppFlowService,
  ],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IntegrationsModule {}
