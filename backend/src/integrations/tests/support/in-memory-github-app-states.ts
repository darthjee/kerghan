import { createInMemoryStateRepo } from './in-memory-oauth-states.js';
import type { IntegrationGithubAppState } from '../../entities/integration-github-app-state.entity.js';

/**
 * In-memory stand-in for `Repository<IntegrationGithubAppState>`.
 * @returns {object} The repository double, exposing its `rows`.
 */
export function createInMemoryGithubAppStateRepo() {
  return createInMemoryStateRepo<IntegrationGithubAppState>();
}

/** The in-memory GitHub App state repository type. */
export type InMemoryGithubAppStateRepo = ReturnType<typeof createInMemoryGithubAppStateRepo>;
