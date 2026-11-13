import { RepositoryRecord } from './repository-record.entity.js';
import { RepositorySourcePage } from './repository-source-page.entity.js';
import { RepositorySourceStatus } from './repository-source-status.entity.js';
import { RepositorySource } from './repository-source.entity.js';
import { RepositorySyncState } from './repository-sync-state.entity.js';

/** Every entity of the Repositories module, for `TypeOrmModule.forFeature` and the DB tier. */
export const REPOSITORIES_ENTITIES = [
  RepositoryRecord,
  RepositorySource,
  RepositorySourcePage,
  RepositorySyncState,
  RepositorySourceStatus,
];
