## Description

This is part of the epic #483 (Issues and Projects) and a follow-up to #487, whose spec work was merged in #500 (`docs/agents/specs/issues/github-link.md` and the files that must stay consistent with it). While #487 was being merged, an enhancement dialogue on the same issue reached better decisions than the merged text. This issue brings the merged specs in line with them. It is documentation only: no code, migrations or endpoints.

## Problem

The merged specs have these weaknesses (each is a decision made in the dialogue, outcomes only; routes, payloads and refusal codes stay with #489):

1. **Undocumented GitHub path.** Reads and pushes of a linked issue address the repository by `/repositories/{id}/issues/{number}`. That path is not in GitHub's REST reference. If it were removed, every read would answer `404` and look like a mass deletion. (Probed unauthenticated on 2026-11-17: the path answers `200` today, and a renamed repository's `301` carries an id-form `Location`.)
2. **False `gone`.** `gone` is terminal (only unlinking leaves it, and relinking replaces local values), but a `404` becomes `gone` when "the repository is readable". A credential with metadata permission only reads the repository and gets `404` on every issue, so every link would turn `gone`.
3. **`sync_failed` can flap.** A successful refresh leaves `sync_failed`, yet a read-only credential still reads (E5), so `forbidden` would flip back to `linked` while the marker is still unsent.
4. **Link creation holds a lock across a network call**, and the attach confirmation can silently replace an edit made after the warning.
5. **Smaller gaps:** a `paused` derived state nobody can read, a possible marker left on a gone link by a race, an unspecified base-snapshot normalization, an unspecified repeat-unlink answer.

## Expected Behavior

`github-link.md` and the related spec files contain the decisions below, with the matching "Required tests" and edge-case rows, and no statement contradicts them.

## Solution

Edit `docs/agents/specs/issues/github-link.md` and keep `edge-cases.md`, `sync.md`, `model.md`, `ui.md`, `projects.md`, `api.md`, `security.md` and `testing.md` consistent in the same PR.

### Addressing and redirects (replaces "by repository id")

- Reads and pushes use the documented `/repos/{owner}/{name}/issues/{number}` with the repository's stored owner and name, and never follow a redirect automatically. A `301` is classified by its `Location`:
  - same repository id and issue number: a rename. Retry once at the `Location`, refresh the stored owner and name (an outcome owned by Repositories, reached through an event or service call), no state change;
  - any other target: a transfer, so the link becomes `gone`, reason `moved` (E2);
  - an unclassifiable `Location`, or a second `301` in one attempt: GitHub unavailable, never `moved` or `gone`.
- Kerghan never builds an id-path URL; the id form is reached only through GitHub's own redirect.
- **Normalized outcomes only.** The link layer and the sync service see only ok, `deleted`, `moved`, not found, unavailable, rate limited and credential results. URLs, status codes and redirect headers stay in the provider adapter, so a future provider is a new adapter. The addressing scheme is never a user setting (all current credential types call the same GitHub API).
- The Integrations client gains `moved`, `gone` (`410`) and an adapter-internal `renamed` outcome; operation names and the other result kinds are #488's.
- **Contract spec.** Records the `200`, `404`, `410` and `301` answers, including the rename redirect and its `Location` form, and is runnable against live GitHub on demand. The `Location` of a transferred issue has not been observed yet: the spec must record it; until then "any other target means moved" is an assumption.
- New edge case **E65**: a `301` on a read or push (rename, transfer, unclassifiable `Location`, second `301`).

### The `gone` guard (E22)

- A `404` sets `gone` only after a probe `GET /repos/{owner}/{name}/issues?per_page=1` answers `200` with the same credential. A failing probe is access loss (E19 path) and keeps the marker. The probe runs only after a `404`. A transfer to a repository the credential cannot read also answers `404` and is labelled `deleted`.
- Setting `gone` and deleting the marker is one transaction in lock order; the edit path locks the link row and creates a marker only while the link is not `gone`. E1 gains a `(race)` check; E22 now requires the probe.

### Link states

- `sync_failed` is left by a successful push that clears the marker, by a successful refresh only when no marker exists, by the retry sync action, or by `gone`. A refresh never clears a failure that belongs to an unsent write. `forbidden` is reached in one attempt, with no retry loop.
- Remove `paused` from the derived states and the precedence order (a denied user is signed out and cannot read it; the worker-side pause stays as E24). Precedence: `gone`, `sync_failed`, repository unavailable, rate limited, pending, `linked`.
- #487 owns the stored vocabulary and `gone`; #488 owns the `sync_failed` reasons and transitions, and the "full set of link states" open question of `sync.md` is narrowed to them. No "links by status" index in v1.
- The GitHub App is registered with Issues: read and no write permission, so a push with that credential ends in `sync_failed`, reason `forbidden`. Whether it gains write permission is #490's decision, and link creation does not warn about a read-only credential.

### Creating a link

- **The GitHub read happens outside the transaction.** Read the project and repository and call GitHub first; then open the transaction, lock the project row (and the issue on attach), re-check the repository is unchanged and not Unavailable, re-check E4 and, on attach, that the issue has no link, and write. A repository changed in between is refused as retryable (E62).
- **Attach confirmation bound to `updated_at`.** The request carries the Kerghan issue's `updated_at`, compared under the issue row lock; a stale value is refused with `409` and the current differences (which of title, body and state differ). Equal values need no confirmation. E61 covers the stale case.
- **Normalization invariant.** One function produces the stored local values, the base snapshot and the operands of the "values differ" test, so after creation the base equals the local columns. The exact rules are #488's.
- Link creation stores `github_issue_id`, `github_number`, the base snapshot, `github_updated_at`, `etag`, `last_synced_at`, `status` `linked` and no reason. The issue number must be a positive integer.

### Unlinking

- The confirmation for unsent changes is a plain explicit flag, not bound to a version: unlinking never destroys local data, it only drops the push. It never travels in a `DELETE` body (the route shape is #489's).
- A push whose request was already sent before the unlink can still land on GitHub; no state is written for it, and the window cannot be closed without a GitHub call inside the unlink.
- Unlinking an issue with no link is a distinct refusal, separate from "issue not found" (E64); the UI treats it as already unlinked.
- The "unlink all" rejection holds only while link creation is one at a time; a later bulk import reopens it.

### Where the merged text changes (checked against `origin/main` at `2e14499`)

- `github-link.md`: the "By repository id" bullet and the `404, repository readable` row of the mapping table; the "Derived at read time" and "Precedence" bullets (`paused`); the validation, attach-confirmation and unlinking bullets; the rejected-alternatives and "Required tests" lists.
- `edge-cases.md`: rows E1 (race check), E22 (probe), E61 (stale confirmation) and E64; the new row E65; the range statement `E1…E64` and the tier lists (E57 to E64 become E57 to E65).
- `testing.md`: the "Id-based path contract spec (required)" bullet becomes the redirect and `Location` contract spec, runnable against live GitHub on demand.
- `sync.md`: the link-states bullet (`paused` is not a link state) and the "full set of link states" open question.
- `model.md`: the `status` note (no `paused`, `status_reason` unchanged); `ui.md` and `api.md`: confirmations and the repeat-unlink answer, wherever they restate the old rules; `projects.md` and `security.md` only if they restate any of the old rules.

### Rejected alternatives to record

The undocumented id path as primary address; a user-selectable addressing scheme per integration; a repository read as the `gone` guard.

## Benefits

- The gone, moved and renamed outcomes no longer depend on an undocumented endpoint or on a guard that a metadata-only credential defeats.
- Link creation never holds a lock across the network, and neither confirmation can silently destroy an edit.

## Acceptance criteria

- `github-link.md` contains the decisions above, its "Required tests" match them, and `edge-cases.md` has E65 plus the updated E1, E22 and E61 rows with tiers.
- `sync.md`, `model.md`, `ui.md`, `projects.md`, `api.md`, `security.md` and `testing.md` are consistent: no `paused` link state, no id-path addressing, no "repository readable" guard.
- No code, migrations or endpoints are added.

## Notes

Responsible agent: `architect`. Builds on #487 (merged in #500).
