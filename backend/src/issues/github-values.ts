import { normalizeBody } from './dto/issue-fields.js';
import type { IssueState } from './entities/issue.entity.js';
import type { AttachDifference } from './issues-http-errors.js';
import type { GithubIssue } from '../integrations/integrations-github.public.js';

/** The three synced values of an issue, in their stored form. */
export interface IssueValues {
  title: string;
  body: string | null;
  state: IssueState;
}

/**
 * The stored form of a GitHub issue's synced values: the title and the state verbatim, the body
 * through `normalizeBody` (so `''` and `null` are both `NULL`). It produces the local values on
 * import, the replacement values on attach, the base snapshot and the operands of the "values
 * differ" test, which keeps the normalization invariant structural
 * (`docs/agents/specs/issues/sync.md#fields-and-ownership`).
 * @param {GithubIssue} issue - The GitHub issue.
 * @returns {IssueValues} The values.
 */
export function githubValues(issue: GithubIssue): IssueValues {
  return { title: issue.title, body: normalizeBody(issue.body), state: issue.state };
}

/** The three synced fields, in the order every list of them uses (title, body, state). */
export const SYNC_FIELDS: readonly AttachDifference[] = ['title', 'body', 'state'];

/**
 * Whether two sets of values agree on one field. The body compares through `normalizeBody`, so
 * `NULL` equals `''`; the title and the state compare verbatim (no trimming, no case folding). The
 * one comparison behind every "values differ" test of the sync, so the normalization invariant
 * stays structural (`docs/agents/specs/issues/sync.md#fields-and-ownership`).
 * @param {AttachDifference} field - The field to compare.
 * @param {IssueValues} a - One side's values.
 * @param {IssueValues} b - The other side's values.
 * @returns {boolean} `true` when the field is equal on both sides.
 */
export function sameField(field: AttachDifference, a: IssueValues, b: IssueValues): boolean {
  return field === 'body' ? normalizeBody(a.body) === normalizeBody(b.body) : a[field] === b[field];
}

/**
 * The fields where a local issue differs from the GitHub values, in the order title, body, state.
 * Bodies compare through `normalizeBody`, so `NULL` equals `''`; nothing else is normalized (no
 * trimming and no case folding).
 * @param {IssueValues} local - The local issue's values.
 * @param {IssueValues} github - The GitHub values, as `githubValues` returns them.
 * @returns {AttachDifference[]} The differing fields; empty when the values match.
 */
export function differencesOf(local: IssueValues, github: IssueValues): AttachDifference[] {
  return SYNC_FIELDS.filter((field) => !sameField(field, local, github));
}
