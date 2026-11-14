/**
 * The Integrations module's public GitHub entry point: the only file other
 * modules (Repositories) import from Integrations. It re-exports
 * `IntegrationsGithubService`, its typed results, the Add candidate walk and
 * the `integration.deleted` event — never an entity, the encryption service
 * or a GitHub client.
 */
export { IntegrationsGithubService } from './integrations-github.service.js';
export type {
  GithubRepo,
  IntegrationRef,
  IntegrationUnusableReason,
  RateLimitFields,
  RepoFailure,
  RepoPageResult,
  RepoResult,
  UnavailableReason,
} from './github-repo-results.js';
export {
  ADD_WALK_MAX_CALLS,
  type AddWalkInput,
  type AddWalkResult,
  type GetRepository,
  walkAddCandidates,
} from './add-candidate-walk.js';
export { INTEGRATION_DELETED, IntegrationDeletedEvent } from './events/integration-deleted.event.js';
export { IntegrationsModule } from './integrations.module.js';
