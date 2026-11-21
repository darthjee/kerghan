/**
 * The Repositories module's public DTO entry point: the only file besides `RepositoriesService`
 * and `RepositoriesModule` that other modules (Issues) import from Repositories. It re-exports
 * the repo-ref DTO and its mapper, so the ref rules stay in one place — never an entity, a
 * store or a sync class.
 */
export { RepoRefDto, toRepoRef } from './dto/repo-ref.dto.js';
export type { RepoRef } from './types/repositories-api.types.js';
