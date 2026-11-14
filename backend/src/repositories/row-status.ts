import { OK_SOURCE_STATUSES, type SourceStatus } from './entities/repository-source-status.entity.js';

/** A listing row's derived status (`docs/agents/modules/repositories.md#row-statuses`). */
export type RowStatus = 'added' | 'not_added' | 'unavailable' | 'unknown';

/** The fields of a repository row the derivation reads. */
export interface RowStatusInput {
  addedAt: Date | null;
  private: boolean;
  integrationId: number | null;
}

/**
 * Reads an access link, treating a dangling one (its integration no longer
 * exists) as empty.
 * @param {number | null} integrationId - The stored `integration_id`.
 * @param {ReadonlySet<number>} existingIntegrationIds - Every integration id of the user.
 * @returns {number | null} The link, or `null` when empty or dangling.
 */
export function effectiveIntegrationId(integrationId: number | null, existingIntegrationIds: ReadonlySet<number>): number | null {
  return integrationId !== null && existingIntegrationIds.has(integrationId) ? integrationId : null;
}

/**
 * Whether a source's latest status vouches for its rows: `ok` and
 * `page_cap_reached` do; a failure or no status row (`pending`) does not.
 * @param {SourceStatus | undefined} status - The stored status, or `undefined` (`pending`).
 * @returns {boolean} `true` when ok.
 */
export function isOkStatus(status: SourceStatus | undefined): boolean {
  return status !== undefined && OK_SOURCE_STATUSES.includes(status);
}

/**
 * Derives a row's status from stored data, never stored itself.
 * @param {RowStatusInput} row - The repository row.
 * @param {string[]} sourceKeys - The source keys holding a row for it.
 * @param {ReadonlyMap<string, SourceStatus>} statuses - The user's stored source statuses, by key.
 * @param {ReadonlySet<number>} existingIntegrationIds - Every integration id of the user.
 * @returns {RowStatus} Added, Not added, Unavailable or Unknown.
 */
export function deriveRowStatus(
  row: RowStatusInput,
  sourceKeys: string[],
  statuses: ReadonlyMap<string, SourceStatus>,
  existingIntegrationIds: ReadonlySet<number>,
): RowStatus {
  if (row.addedAt === null) return 'not_added';
  if (sourceKeys.length === 0) return 'unavailable';
  if (row.private && effectiveIntegrationId(row.integrationId, existingIntegrationIds) === null) return 'unavailable';

  return sourceKeys.some((key) => isOkStatus(statuses.get(key))) ? 'added' : 'unknown';
}
