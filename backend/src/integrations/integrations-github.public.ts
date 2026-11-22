/**
 * The Integrations module's public GitHub entry point: the only file other
 * modules (Repositories, Issues) import from Integrations. It re-exports
 * `IntegrationsGithubService` (the `GET`-only reads), `IntegrationsGithubIssueWriter`
 * (the one write, injectable only by the issues sync service), their typed
 * results, the Add candidate walk and the `integration.deleted` event — never
 * an entity, the encryption service or a GitHub client.
 */
export { IntegrationsGithubIssueWriter } from './integrations-github-issue-writer.service.js';
export { IntegrationsGithubService } from './integrations-github.service.js';
export type {
  GithubRepo,
  IntegrationRef,
  IntegrationUnusableReason,
  IssuesWriteCapability,
  RateLimitFields,
  RepoFailure,
  RepoPageResult,
  RepoResult,
  UnavailableReason,
} from './github-repo-results.js';
export type {
  GithubIssue,
  GithubIssueChanges,
  GithubIssueRepo,
  IssueFailure,
  IssueProbeResult,
  IssueResult,
  IssueUpdateResult,
  RenamedTo,
} from './github-issue-results.js';
export {
  ADD_WALK_MAX_CALLS,
  type AddWalkInput,
  type AddWalkResult,
  type GetRepository,
  walkAddCandidates,
} from './add-candidate-walk.js';
export { INTEGRATION_DELETED, IntegrationDeletedEvent } from './events/integration-deleted.event.js';
export { IntegrationsModule } from './integrations.module.js';
