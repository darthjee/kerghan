import { Module, type Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Clock, SystemClock } from '../core/clock.js';
import { IntegrationsModule } from '../integrations/integrations-github.public.js';
import { REPOSITORIES_ENTITIES } from './entities/index.js';
import { HandleReconciler } from './handle-reconciler.js';
import { LinkFiller } from './link-filler.js';
import { PageWriter } from './page-writer.js';
import { Pruner } from './pruner.js';
import { RepositoriesConfig } from './repositories-config.js';
import { SourceRunner } from './source-runner.js';
import { SyncFinisher } from './sync-finisher.js';
import { DetachedSyncLauncher, SyncLauncher } from './sync-launcher.js';
import { SyncRunner } from './sync-runner.js';
import { SyncStateStore } from './sync-state.store.js';

/**
 * The Repositories module's own providers (everything but the injected
 * `Clock` / `SyncLauncher` and the cross-module services), shared with the
 * DB-tier harness so specs wire the same graph.
 */
export const REPOSITORIES_PROVIDERS: Provider[] = [
  RepositoriesConfig,
  Pruner,
  SyncStateStore,
  HandleReconciler,
  PageWriter,
  SourceRunner,
  LinkFiller,
  SyncFinisher,
  SyncRunner,
];

/**
 * The Repositories module — always-on (imported directly into `AppModule`,
 * so its `integration.deleted` / `user.deleted` listeners exist at boot):
 * the per-user snapshot of every GitHub repository seen by a sync, and the
 * in-process sync engine that fills it (see `docs/agents/specs/repos/`).
 * Owns tables `repositories`, `repositories_sources`,
 * `repositories_source_pages`, `repositories_sync_states` and
 * `repositories_source_statuses`; `user_id` / `integration_id` are logical
 * FKs only. It reads Auth only through `AccountHandleService` and calls
 * GitHub only through Integrations' exported `IntegrationsGithubService`.
 */
@Module({
  imports: [TypeOrmModule.forFeature(REPOSITORIES_ENTITIES), AuthModule, IntegrationsModule],
  providers: [
    ...REPOSITORIES_PROVIDERS,
    { provide: Clock, useClass: SystemClock },
    { provide: SyncLauncher, useClass: DetachedSyncLauncher },
  ],
  exports: [],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RepositoriesModule {}
