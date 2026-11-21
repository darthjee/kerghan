/**
 * The Repositories module's public DTO and type entry point: the only file besides `RepositoriesService`
 * and `RepositoriesModule` that other modules (Issues) import from Repositories. It re-exports
 * the repo-ref DTO and its mapper (so the ref rules stay in one place) and the lookup types — never an entity, a
 * store or a sync class.
 */
export { RepoRefDto, toRepoRef } from './dto/repo-ref.dto.js';
export type { ProjectRepositoryLookup, RepoRef, RepositorySummary } from './types/repositories-api.types.js';
