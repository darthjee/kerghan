import { Module, type Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ISSUES_ENTITIES } from './entities/index.js';
import { IssuesAccess } from './issues-access.js';
import { IssuesConfig } from './issues-config.js';
import { IssuesEventsListener } from './issues-events.listener.js';
import { AuthModule } from '../auth/auth.module.js';
import { Clock, SystemClock } from '../core/clock.js';
import { RepositoriesModule } from '../repositories/repositories.module.js';

/**
 * The Issues module's own providers (everything but the injected `Clock` and the cross-module
 * services), shared with the DB-tier harness so specs wire the same graph.
 */
export const ISSUES_PROVIDERS: Provider[] = [
  IssuesConfig,
  IssuesAccess,
  IssuesEventsListener,
];

/**
 * The Issues module — always-on (imported directly into `AppModule`, so its `user.deleted`
 * listener exists at boot): projects and the Kerghan issues that belong to them, each issue
 * optionally linked to one GitHub issue (see `docs/agents/specs/issues.md`). Owns tables
 * `issues_projects`, `issues`, `issues_github_links` and `issues_pending_writes`; every
 * `*_id` is a logical FK only. It has no controller yet. It reads Auth through
 * `AccountHandleService` and Repositories through the exported `RepositoriesService`.
 */
@Module({
  imports: [TypeOrmModule.forFeature(ISSUES_ENTITIES), AuthModule, RepositoriesModule],
  providers: [
    ...ISSUES_PROVIDERS,
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [IssuesAccess],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IssuesModule {}
