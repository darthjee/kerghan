import { QueryFailedError } from 'typeorm';

// MySQL's driver error code for a unique-index violation.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

/**
 * Whether a write failed on a unique index.
 * @param {unknown} error - The caught value.
 * @returns {boolean} `true` for MySQL's `ER_DUP_ENTRY`.
 */
export function isDuplicateEntry(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return typeof driverError === 'object' && driverError !== null
    && (driverError as { code?: unknown }).code === MYSQL_DUPLICATE_ENTRY_CODE;
}
