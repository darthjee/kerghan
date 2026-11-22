import { sameField, SYNC_FIELDS, type IssueValues } from './github-values.js';
import type { AttachDifference } from './issues-http-errors.js';

/** What the per-field merge reads. */
export interface MergeInput {
  /** Kerghan's current values (L). */
  local: IssueValues;
  /** The base snapshot (B). */
  base: IssueValues;
  /** GitHub's current values (G); the base itself after a `304`. */
  remote: IssueValues;
  /** `Tm`: the marker's last edit (E7). */
  localEditedAt: Date;
  /** GitHub's `updated_at` (E7). */
  remoteUpdatedAt: Date;
}

/** What the merge decided, field by field; each field is in at most one of the three. */
export interface MergePlan {
  /** Fields to send to GitHub, with Kerghan's value. */
  push: Partial<IssueValues>;
  /** Fields where local and base take GitHub's value. */
  pull: Partial<IssueValues>;
  /** Fields where both sides changed to the same value (E8): the base takes it, nothing is sent. */
  adopt: Partial<IssueValues>;
}

type Decision = 'none' | 'pull' | 'push' | 'adopt';

/**
 * The table of `docs/agents/specs/issues/sync.md#reconcile` for one field.
 * @param {AttachDifference} field - The field.
 * @param {MergeInput} input - The three value sets and the two timestamps.
 * @returns {Decision} What to do with the field.
 */
function decide(field: AttachDifference, input: MergeInput): Decision {
  const localMoved = !sameField(field, input.local, input.base);
  const remoteMoved = !sameField(field, input.remote, input.base);

  if (!localMoved) return remoteMoved ? 'pull' : 'none';
  if (!remoteMoved) return 'push';
  if (sameField(field, input.local, input.remote)) return 'adopt';

  // E7: the newest edit wins, and a tie goes to Kerghan.
  return input.localEditedAt >= input.remoteUpdatedAt ? 'push' : 'pull';
}

/**
 * @param {IssueValues} values - A set of values.
 * @param {AttachDifference} field - One field.
 * @returns {Partial<IssueValues>} Only that field.
 */
function only(values: IssueValues, field: AttachDifference): Partial<IssueValues> {
  return { [field]: values[field] };
}

/**
 * Merges Kerghan's and GitHub's values per field against the base snapshot (E6 to E9). Pure: it
 * reads nothing and writes nothing. Values compare through `sameField`, so `NULL` equals `''`.
 * @param {MergeInput} input - The values and timestamps.
 * @returns {MergePlan} The fields to push, to pull and to adopt.
 */
export function mergeFields(input: MergeInput): MergePlan {
  const plan: MergePlan = { push: {}, pull: {}, adopt: {} };

  for (const field of SYNC_FIELDS) {
    const decision = decide(field, input);

    if (decision === 'push') Object.assign(plan.push, only(input.local, field));
    if (decision === 'pull') Object.assign(plan.pull, only(input.remote, field));
    if (decision === 'adopt') Object.assign(plan.adopt, only(input.local, field));
  }

  return plan;
}
