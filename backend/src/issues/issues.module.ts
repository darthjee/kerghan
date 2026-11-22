import { Module, type Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ISSUES_ENTITIES } from './entities/index.js';
import { IssueCandidates } from './issue-candidates.js';
import { IssueEditRateLimiter } from './issue-edit-rate-limiter.js';
import { IssueGithubReader } from './issue-github-reader.js';
import { IssueLinkPresenter } from './issue-link-presenter.js';
import { IssueLinkRateLimiter } from './issue-link-rate-limiter.js';
import { IssueLinkStore } from './issue-link-store.js';
import { IssueLinkWriter } from './issue-link-writer.js';
import { IssueLinksController } from './issue-links.controller.js';
import { IssueLinksService } from './issue-links.service.js';
import { IssueMarkers } from './issue-markers.js';
import { IssueRateLimitPauses } from './issue-rate-limit-pauses.js';
import { IssueRateLimitWaits } from './issue-rate-limit-waits.js';
import { IssueReconcileQueue } from './issue-reconcile-queue.js';
import { IssueStore } from './issue-store.js';
import { IssueSyncCommit } from './issue-sync-commit.js';
import { EnqueueIssueSyncTrigger } from './issue-sync-enqueuer.js';
import { IssueSyncGithub } from './issue-sync-github.js';
import { IssueSyncQueue } from './issue-sync-queue.js';
import { IssueSyncReader } from './issue-sync-reader.js';
import { IssueSyncTrigger } from './issue-sync-trigger.js';
import { IssuesAccess } from './issues-access.js';
import { IssuesConfig } from './issues-config.js';
import { IssuesEventsListener } from './issues-events.listener.js';
import { IssuesSyncBootstrap } from './issues-sync.bootstrap.js';
import { IssuesSyncService } from './issues-sync.service.js';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { ProjectOpenIssueCounts } from './open-issue-count.query.js';
import { ProjectCreator } from './project-creator.js';
import { ProjectLinks } from './project-links.js';
import { ProjectRepositoryChanger } from './project-repository-changer.js';
import { ProjectStore } from './project-store.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { Clock, SystemClock } from '../core/clock.js';
import { Scheduler, SystemScheduler } from '../core/scheduler.js';
import { IntegrationsModule } from '../integrations/integrations-github.public.js';
import { RepositoriesModule } from '../repositories/repositories.module.js';
import { WorkersModule } from '../workers/workers.module.js';

/**
 * The Issues module's own providers (everything but the injected `Clock` and `Scheduler` and the cross-module
 * services), shared with the DB-tier harness so specs wire the same graph.
 */
export const ISSUES_PROVIDERS: Provider[] = [
  IssuesConfig,
  IssuesAccess,
  IssuesEventsListener,
  IssueEditRateLimiter,
  IssueLinkRateLimiter,
  IssueCandidates,
  IssueGithubReader,
  IssueLinkStore,
  IssueLinkWriter,
  IssueLinksService,
  IssueLinkPresenter,
  IssueRateLimitPauses,
  { provide: IssueRateLimitWaits, useExisting: IssueRateLimitPauses },
  IssueSyncQueue,
  { provide: IssueReconcileQueue, useExisting: IssueSyncQueue },
  IssueMarkers,
  IssueStore,
  IssueSyncReader,
  IssueSyncCommit,
  IssueSyncGithub,
  IssuesSyncService,
  IssuesSyncBootstrap,
  IssuesService,
  { provide: IssueSyncTrigger, useClass: EnqueueIssueSyncTrigger },
  ProjectOpenIssueCounts,
  ProjectCreator,
  ProjectLinks,
  ProjectRepositoryChanger,
  ProjectStore,
  ProjectsService,
];

/**
 * The Issues module — always-on (imported directly into `AppModule`, so its `user.deleted`
 * listener exists at boot): projects and the Kerghan issues that belong to them, each issue
 * optionally linked to one GitHub issue (see `docs/agents/specs/issues.md`). Owns tables
 * `issues_projects`, `issues`, `issues_github_links` and `issues_pending_writes`; every
 * `*_id` is a logical FK only. Its controllers are `ProjectsController` (the Projects API) and `IssuesController` (the Issues API). It reads Auth through
 * `AccountHandleService` and Repositories through the exported `RepositoriesService`.
 * The GitHub link routes (`IssueLinksController`) are the only Issues code that calls GitHub, and
 * only through the exported, `GET`-only `IntegrationsGithubService` (the one read of a link
 * creation); it writes nothing to GitHub. It imports `WorkersModule` for the sync job (#558).
 */
@Module({
  imports: [TypeOrmModule.forFeature(ISSUES_ENTITIES), AuthModule, RepositoriesModule, IntegrationsModule, WorkersModule],
  providers: [
    ...ISSUES_PROVIDERS,
    { provide: Clock, useClass: SystemClock },
    { provide: Scheduler, useClass: SystemScheduler },
  ],
  controllers: [ProjectsController, IssuesController, IssueLinksController],
  exports: [IssuesAccess],
})
// NestJS module classes are intentionally empty; all behavior lives in @Module().
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class IssuesModule {}
