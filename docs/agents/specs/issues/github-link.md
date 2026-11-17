# Issues and Projects — GitHub link

The optional one-to-one link between a Kerghan issue and a GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

Routes, payloads and refusal codes stay with #489; synced fields, conflicts, retry values and the `sync_failed` transitions with #488; encryption, retention, quotas and rendering of GitHub content with #490; wording and placement with #491. Columns are in [model.md](model.md#issues_github_links).

- One to one, per user: unique on user and GitHub issue. Two users may link the same GitHub issue.
- The link is optional.
- A project's links are deleted when the project is deleted, which frees their GitHub issues for another project ([projects.md](projects.md#deletion)).
- Stored in `issues_github_links`: unique on (`user_id`, `github_issue_id`) and on `issue_id`; keyed by GitHub's global issue id plus its number; issues only; a base snapshot of title, body and state. The columns are not repeated here.

## Creating a link

- **Two ways, one service method.** *Import* creates a new Kerghan issue from a GitHub issue; *attach* links a GitHub issue to an existing, unlinked Kerghan issue.
- **Synchronous read.** The request makes one `GET` of the GitHub issue with the project owner's credential (inside the Integrations module), validates it and stores the link in one transaction. There is no job and no marker, so no half-done "linking" state exists and a refusal is immediate.
- **Identifier.** The API takes the **issue number in the project's repository**. The repository is always the project's, so the same-repository rule is structural; a pasted URL is parsed into a number by the UI, which refuses another repository. The stored `github_issue_id` comes from GitHub's answer.
- **Validation,** all before any write: the project has a repository that is not Unavailable; the issue exists and is readable; it is not a pull request (E3); it is not already linked by this user (E4, E46: the unique index decides races); the Kerghan issue (attach) has no link yet (E64).
- **GitHub's values win, with confirmation.** On attach the local title, body and state are replaced by GitHub's and the base snapshot equals them, so attach never writes to GitHub and creates no marker. The request needs an explicit confirmation when the local values differ from GitHub's (the UI warns first, E61). Import takes GitHub's values and needs no confirmation. A closed GitHub issue is allowed and stored as `closed`.
- **One at a time.** There is no list call, bulk import or pagination in v1; a bulk import can later reuse the same method.
- **A failed creation stores nothing, creates no job and never waits.** The failure outcomes are E57 to E60 of [edge-cases.md](edge-cases.md#link-creation-unlinking-and-repository-change): not found, `410` or `301` (refused as not found); rate limited (refused with `retryAfterSeconds`); no usable integration, `401` or `403` (refused with the credential reason; a `401` invalidates the integration, a `403` does not, and a handle alone is not enough, E20); timeout, network error or `5xx` (refused as GitHub unavailable).

## Same-repository rule and repository changes

- A project with no repository cannot link (`409`).
- Link creation is refused (no GitHub call) while the repository is Unavailable and allowed while it is Unknown, the same gating as sync ([projects.md](projects.md#linked-repository-unavailable-or-removed)); a dangling repository reads as Unavailable.
- **Changing or detaching a repository is allowed only while the project has zero links.** With any link it is refused with `409` carrying the link count (the user unlinks first, E62). This replaces v1's blanket refusal; [projects.md](projects.md#changing-a-project-later) and [api.md](api.md) follow it. The change keeps the attach checks (an added repository of the caller, no other live project of the user on it) and never syncs.
- **No race.** Link creation and the repository change both lock the project row first (the module's lock order already starts with projects, [model.md](model.md#cleanup)) and re-check inside the transaction, so a link is never created against a repository that has just changed. The link still needs no `repository_id`.

## Unlinking

- **Who:** the project's owner, through the single access check (another user's or a deleted project answers `404`).
- **When:** in any link state, including gone, sync failed and repository Unavailable. Unlinking never makes a GitHub call.
- **Effect,** in one transaction in lock order (project, issue, link, marker): the link row and its marker are deleted. The Kerghan issue is kept as it is, GitHub is never touched, and the GitHub issue is freed: this user may link it again, from this or another project (E47).
- **Unsent changes need a confirmation.** If a marker exists the request must carry an explicit confirmation, otherwise it is refused with `409` saying unsent changes exist; with it the marker is discarded and the response says changes were dropped (E63). Pushing first is rejected: it needs GitHub and a working credential exactly when they fail.
- An in-flight push finds no link or marker and is a no-op (E44). Unlinking an issue with no link is not a success but a missing resource; the code is #489's (E64).
- Relinking is a new attach, so local edits made after the unlink are replaced after confirmation. One issue at a time: no project-level "unlink all" in v1. No history or audit of unlinks.

## Gone, transferred and repository unreachable

| GitHub answers | Meaning | Outcome |
|---|---|---|
| `404`, repository readable with the same credential | Issue deleted | Link `gone`, reason `deleted` (E1, E22) |
| `410` | Issue deleted, or issues disabled on the repository | Link `gone`, reason `deleted` (the label says only that it is no longer available on GitHub) |
| `404`, repository not readable | Access lost | Not `gone`; follows E19, the marker is kept (E22) |
| `301` | Issue transferred | Link `gone`, reason `moved` (E2) |
| `403` on a push | Read-only credential or archived repository | E5 and E21, unchanged |
| Repository Unavailable | Repository deleted or lost to the credential | Links and markers untouched, not `gone` (E27) |

- **By repository id.** Reads and pushes of a linked issue address the repository by its stable GitHub id (`/repositories/{id}/issues/{number}`), so a rename or transfer of the repository never redirects and any `301` means the issue moved. The implementation proves the id-based path in a recorded contract spec ([testing.md](testing.md#fixtures)). Fallback if GitHub does not honour it: owner/name URLs and, on a `301`, a re-read of the repository by id (a changed full name is a rename, no state change; otherwise a transfer).
- The Integrations client gains a distinct `moved` result (`301`, today `unavailable/redirect`) and a `gone` result (`410`); operation names and the other result kinds are #488's.
- **Gone is left only by unlinking.** A gone link creates no marker, makes no push and no refresh, and its edits are local only (E1). The Kerghan issue is never deleted or closed. The GitHub issue id stays reserved by the unique index until the unlink. Kerghan never follows a transfer (E2).
- Pull requests are refused on attach and skipped on import and refresh (E3); GitHub never converts an issue to a pull request, so no state exists for it.

## Link states

- **Stored** in `status` (`varchar(32)`) plus a nullable `status_reason` (`varchar(32)`) ([model.md](model.md#issues_github_links)):

  | `status` | `status_reason` | Set by | Left by |
  |---|---|---|---|
  | `linked` | none | Link creation; any successful push or refresh | `gone` or `sync_failed` |
  | `gone` | `deleted`, `moved` | The rules above | Unlinking only |
  | `sync_failed` | `retries_exhausted`, `no_credential`, `credential_invalid`, `forbidden` | #488 (E18 to E21) | A successful push or refresh, or the retry sync action; or `gone` if a later read says so |

  #488 may add reasons to the same column in its own PR; this file fixes only `linked`, `gone` and its two reasons.
- **Derived at read time, never stored:** *pending* (a marker exists), *rate limited until X* (in memory, E17), *repository unavailable* (the repository's status) and *paused* (user not `approved`, E24). An edit never writes a status.
- **Precedence** when several apply: `gone`, `sync_failed`, repository unavailable, paused, rate limited, pending, `linked`. A read exposes the primary state and the list of all that apply; #489 and #491 decide wording and placement. An unlinked issue has no state.
- Gone offers unlink and no retry sync; sync failed offers retry sync and, for a credential reason, a pointer to Integrations ([ui.md](ui.md)).

## Edge cases

The rows live in [edge-cases.md](edge-cases.md), the single index: E1 to E5 and E22 (gone, transferred, pull request, already linked, access loss) and E57 to E64 (link creation failures, attach confirmation, repository change, unlink). A change of outcome is made here first, then reflected there.

## Not decided

- Out of scope in v1: creating a GitHub issue from a Kerghan issue, bulk import, following transfers, labels, assignees, milestones, comments, pull requests as links, projects backed by several repositories.
- Rejected alternatives: asynchronous link creation (needs a "linking" state); Kerghan's values winning on attach (can destroy remote content); a URL as identifier (one more refusal case); following a transfer (a link would leave the project's repository); a manual refresh reviving a gone link (a second exit, more tests; E22 already guards against a false `gone`); "unlink all"; pushing before unlinking; storing `synced` and `pending` (duplicates the marker, can disagree after a crash); encoding the reason in the status value.

## Open questions

None owned by #487. What remains is owned elsewhere:

- [ ] Operation names, result kinds and the `sync_failed` reasons and transitions. (#488)
- [ ] Routes, payloads, refusal codes and how the states and confirmations are exposed. (#489)
- [ ] Wording and placement of the states and confirmations. (#491)
- [ ] Rendering of GitHub content. (#490)

The id-based path and the `301`, `404` and `410` answers are proven by the contract spec of [testing.md](testing.md#fixtures), not an open question.

## Compatibility, performance and security

- Nothing shipped changes: `status_reason` is added to a table that is not built yet, and the repository-change rule is replaced before any implementation exists.
- Link creation costs one GitHub read in the request, bounded by the Integrations client's timeout and rate-limit handling; unlinking costs no GitHub call.
- A not-found answer never reveals whether an issue exists beyond what the owner's credential can read. The owner's credentials do all GitHub work, never the browser. GitHub content and credentials never appear in logs or job params (ids only). A link or unlink never crosses users (the link's `user_id` is for uniqueness only).

## Required tests

Tiers follow [testing.md](testing.md#tiers): unit on the sync service with the fake GitHub client for the failure mapping, e2e for the attach, unlink and repository-change answers, `(db)` for the unique indexes, the project-row lock race and unlink cleanup. The unique indexes and link cleanup are also in [model.md](model.md#required-tests).

- Import creates a Kerghan issue with GitHub's values; attach replaces the local values only with the confirmation, writes nothing to GitHub and creates no marker (E61); a closed GitHub issue is stored as `closed`.
- A project with no repository cannot link; link creation is refused with no GitHub call while the repository is Unavailable and allowed while Unknown; the issue number is read in the project's repository.
- A pull request is refused on attach and skipped on import (E3); an already linked GitHub issue (E4, E46 `(db)`) and an already linked Kerghan issue (E64) are refused. Two users may link the same GitHub issue (E45).
- Failed link creation stores nothing, creates no job and never waits: not found, `410`, `301` (E57), rate limited (E58), no integration, `401`, `403` (E59), timeout, network error, `5xx` (E60).
- Changing or detaching a repository is allowed at zero links and refused with `409` and the link count otherwise; a concurrent link creation is never left against a changed repository `(db)` (E62).
- Unlinking deletes the link and its marker, keeps the issue, makes no GitHub call and frees the GitHub issue (E47); it is refused without the confirmation while a marker exists, and with it the marker is discarded (E63); it works in every state; another user's or a deleted project answers `404`; an in-flight push is a no-op (E44) `(race)`; unlinking an unlinked issue is refused (E64).
- A deleted issue (`404` with a readable repository, `410`) and a transferred one (`301`) make the link `gone` with reason `deleted` or `moved` (E1, E2); a `404` with an unreadable repository does not (E22); a gone link creates no marker, makes no push or refresh and leaves only by unlinking.
- The id-based path and the `301`, `404` and `410` answers are covered by the recorded contract spec ([testing.md](testing.md#fixtures)).
- Deleting a project releases its links and frees their GitHub issues.
