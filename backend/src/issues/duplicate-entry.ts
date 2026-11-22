import { QueryFailedError } from 'typeorm';

/** The unique index of a project's live name per user. */
export const PROJECT_NAME_INDEX = 'idx_issues_projects_user_id_name_deleted_token';
/** The unique index of a repository per user's live project. */
export const PROJECT_REPOSITORY_INDEX = 'idx_issues_projects_user_id_repository_id_deleted_token';
/** The unique index of a project's public id. */
export const PROJECT_UUID_INDEX = 'idx_issues_projects_uuid';
/** The unique index of an issue's public id. */
export const ISSUE_UUID_INDEX = 'idx_issues_uuid';
/** The unique index of a GitHub issue per user (`user_id`, `github_issue_id`). */
export const LINK_USER_GITHUB_ISSUE_INDEX = 'idx_issues_github_links_user_id_github_issue_id';
/** The unique index of a link per Kerghan issue. */
export const LINK_ISSUE_INDEX = 'idx_issues_github_links_issue_id';
/** The unique index of a pending-write marker per link. */
export const MARKER_LINK_INDEX = 'idx_issues_pending_writes_link_id';

/**
 * Every unique index of the Issues tables and where its `ER_DUP_ENTRY` is mapped, so that the
 * duplicated value (MySQL's message carries it) never reaches an unhandled-exception log. A static
 * check (`issues-unique-index.logging.db-spec.ts`) fails when the entities declare a unique index
 * that is not listed here.
 */
export const ISSUES_UNIQUE_INDEX_MAPPINGS: ReadonlyArray<{ index: string; mappedBy: string }> = [
  { index: PROJECT_NAME_INDEX, mappedBy: '409 PROJECT_NAME_TAKEN (project creation and edit)' },
  { index: PROJECT_REPOSITORY_INDEX, mappedBy: '409 PROJECT_REPOSITORY_TAKEN (project creation and repository change)' },
  { index: PROJECT_UUID_INDEX, mappedBy: 'a random v4 uuid: no route can provoke it' },
  { index: ISSUE_UUID_INDEX, mappedBy: 'a random v4 uuid: no route can provoke it' },
  { index: LINK_USER_GITHUB_ISSUE_INDEX, mappedBy: '409 GITHUB_ISSUE_ALREADY_LINKED (import and attach)' },
  { index: LINK_ISSUE_INDEX, mappedBy: '409 ISSUE_ALREADY_LINKED (attach)' },
  { index: MARKER_LINK_INDEX, mappedBy: 'the marker upsert (ON DUPLICATE KEY UPDATE): a second edit bumps the revision, no error' },
];

// MySQL's driver error code for a unique-index violation.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

// MySQL 8 names the violated key as `table.index` in the message: `... for key 'issues_projects.idx_x'`.
// The duplicated value comes first in the message, unescaped, so a value (a project name) can imitate
// `for key '...'`: the match is anchored to the end of the message, where the real key always is.
const KEY_IN_MESSAGE = /for key '(?:[^'.]*\.)?([^']+)'\s*$/;

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
