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

/**
 * The fields where a local issue differs from the GitHub values, in the order title, body, state.
 * Bodies compare through `normalizeBody`, so `NULL` equals `''`; nothing else is normalized (no
 * trimming and no case folding).
 * @param {IssueValues} local - The local issue's values.
 * @param {IssueValues} github - The GitHub values, as `githubValues` returns them.
 * @returns {AttachDifference[]} The differing fields; empty when the values match.
 */
export function differencesOf(local: IssueValues, github: IssueValues): AttachDifference[] {
  const differences: AttachDifference[] = [];

  if (local.title !== github.title) differences.push('title');
  if (normalizeBody(local.body) !== normalizeBody(github.body)) differences.push('body');
  if (local.state !== github.state) differences.push('state');

  return differences;
}
