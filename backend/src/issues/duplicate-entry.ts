import { QueryFailedError } from 'typeorm';

// MySQL's driver error code for a unique-index violation.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

// MySQL 8 names the violated key as `table.index` in the message: `... for key 'issues_projects.idx_x'`.
const KEY_IN_MESSAGE = /for key '(?:[^'.]*\.)?([^']+)'/;

/**
 * Reads which unique index an insert violated.
 * @param {unknown} error - The error thrown by an insert.
 * @returns {string | null} The index name (without the table prefix; `''` when the message names
 *   none), or `null` when the error is not a unique-index violation.
 */
export function duplicateEntryIndex(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;

  const driverError: unknown = error.driverError;

  if (typeof driverError !== 'object' || driverError === null || !('code' in driverError)) return null;
  if (driverError.code !== MYSQL_DUPLICATE_ENTRY_CODE) return null;

  const message = 'sqlMessage' in driverError ? driverError.sqlMessage : error.message;

  return KEY_IN_MESSAGE.exec(String(message))?.[1] ?? '';
}
