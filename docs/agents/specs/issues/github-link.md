# Issues and Projects — GitHub link

The optional one-to-one link between a Kerghan issue and a GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

Routes, payloads and refusal codes are decided in [api.md](api.md); synced fields, conflicts, retry values and the `sync_failed` transitions in [sync.md](sync.md); encryption, retention, quotas and rendering of GitHub content in [security.md](security.md) (#490); wording and placement with #491. Columns are in [model.md](model.md#issues_github_links).

- One to one, per user: unique on user and GitHub issue. Two users may link the same GitHub issue.
- The link is optional.
- A project's links are deleted when the project is deleted, which frees their GitHub issues for another project ([projects.md](projects.md#deletion)).
- Stored in `issues_github_links`: unique on (`user_id`, `github_issue_id`) and on `issue_id`; keyed by GitHub's global issue id plus its number; issues only; a base snapshot of title, body and state. The columns are not repeated here.

## Creating a link

- **Two ways, one service method.** *Import* creates a new Kerghan issue from a GitHub issue; *attach* links a GitHub issue to an existing, unlinked Kerghan issue.
- **Synchronous read, outside the transaction.** The request reads the project and its repository, makes one `GET` of the GitHub issue with the project owner's credential (inside the Integrations module) and only then opens the transaction: it locks the project row (and, on attach, the issue row), re-checks that the repository is unchanged and not Unavailable, re-checks E4 and, on attach, that the issue still has no link, and writes. No lock is held across the network call. A repository changed in between is refused as retryable (E62). There is no job and no marker, so no half-done "linking" state exists and a refusal is immediate.
- **Identifier.** The API takes the **issue number in the project's repository**. The repository is always the project's, so the same-repository rule is structural; a pasted URL is parsed into a number by the UI, which refuses another repository. The issue number must be a positive integer. The stored `github_issue_id` comes from GitHub's answer.
- **Validation,** all before any write: the project has a repository that is not Unavailable; the issue exists and is readable; it is not a pull request (E3); it is not already linked by this user (E4, E46: the unique index decides races); the Kerghan issue (attach) has no link yet (E64).
- **GitHub's values win, with confirmation bound to `updated_at`.** On attach the local title, body and state are replaced by GitHub's and the base snapshot equals them, so attach never writes to GitHub and creates no marker. When the local values differ from GitHub's the UI warns first and the request carries the Kerghan issue's `updated_at` as the confirmation. It is compared under the issue row lock: a stale value (the issue was edited after the warning) is refused with `409` and the current differences (which of title, body and state differ), so an edit made after the warning is never silently replaced (E61). Equal values need no confirmation. Import takes GitHub's values and needs no confirmation. A closed GitHub issue is allowed and stored as `closed`.
- **Normalization invariant.** One function produces the stored local values, the base snapshot and the operands of the "values differ" test, so after creation the base equals the local columns. The rule: values are stored verbatim as GitHub returns them, a blank body is stored as `NULL`, `NULL` equals `''` in every comparison, and there is no other normalization ([sync.md](sync.md#fields-and-ownership)).
- **Stored on creation:** `github_issue_id`, `github_number`, the base snapshot, `github_updated_at`, `etag`, `last_synced_at`, `status` `linked` and no reason.
- **One at a time.** There is no list call, bulk import or pagination in v1; a bulk import can later reuse the same method.
- **A failed creation stores nothing, creates no job and never waits.** The failure outcomes are E57 to E60 of [edge-cases.md](edge-cases.md#link-creation-unlinking-and-repository-change): not found, `410` or a `301` that is not a rename (refused as not found); rate limited (refused with `retryAfterSeconds`); no usable integration, `401` or `403` (refused with the credential reason; a `401` invalidates the integration, a `403` does not, and a handle alone is not enough, E20); timeout, network error or `5xx` (refused as GitHub unavailable).

## Same-repository rule and repository changes

- A project with no repository cannot link (`409`).
- Link creation is refused (no GitHub call) while the repository is Unavailable and allowed while it is Unknown, the same gating as sync ([projects.md](projects.md#linked-repository-unavailable-or-removed)); a dangling repository reads as Unavailable.
- **Changing or detaching a repository is allowed only while the project has zero links.** With any link it is refused with `409` carrying the link count (the user unlinks first, E62). This replaces v1's blanket refusal; [projects.md](projects.md#changing-a-project-later) and [api.md](api.md) follow it. The change keeps the attach checks (an added repository of the caller, no other live project of the user on it) and never syncs.
- **No race.** Link creation and the repository change both lock the project row first (the module's lock order already starts with projects, [model.md](model.md#cleanup)) and re-check inside the transaction, so a link is never created against a repository that has just changed. The link still needs no `repository_id`.

## Unlinking

- **Who:** the project's owner, through the single access check (another user's or a deleted project answers `404`).
- **When:** in any link state, including gone, sync failed and repository Unavailable. Unlinking never makes a GitHub call.
- **Effect,** in one transaction in lock order (project, issue, link, marker): the link row and its marker are deleted. The Kerghan issue is kept as it is, GitHub is never touched, and the GitHub issue is freed: this user may link it again, from this or another project (E47).
- **Unsent changes need a plain confirmation.** If a marker exists the request must carry an explicit confirmation flag, otherwise it is refused with `409 ISSUE_UNLINK_HAS_UNSENT_CHANGES`; with it (`discardUnsentChanges: true` on `unlink.json`) the marker is discarded and the response says `droppedUnsentChanges` (E63). The flag is not bound to a version: unlinking never destroys local data, it only drops the push. It never travels in a `DELETE` body (every route is `POST`, [api.md](api.md#every-route)). Pushing first is rejected: it needs GitHub and a working credential exactly when they fail.
- An in-flight push finds no link or marker and is a no-op (E44). A push whose request was already sent before the unlink can still land on GitHub; no state is written for it, and the window cannot be closed without a GitHub call inside the unlink.
- Unlinking an issue with no link is a distinct refusal, separate from "issue not found" (E64); it answers `409 ISSUE_NOT_LINKED` and the UI treats it as already unlinked.
- Relinking is a new attach, so local edits made after the unlink are replaced after confirmation. One issue at a time: no project-level "unlink all" in v1; the rejection holds only while link creation is one at a time, a later bulk import reopens it. No history or audit of unlinks.

## Gone, transferred and repository unreachable

| GitHub answers | Meaning | Outcome |
|---|---|---|
| `404`, and the probe `GET /repos/{owner}/{name}/issues?per_page=1` answers `200` with the same credential | Issue deleted | Link `gone`, reason `deleted` (E1, E22) |
| `410` | Issue deleted, or issues disabled on the repository | Link `gone`, reason `deleted` (the label says only that it is no longer available on GitHub) |
| `404`, and the probe fails | Access lost | Not `gone`; follows E19, the marker is kept (E22) |
| `301`, same repository id and issue number | Repository renamed | Retry once at the `Location`, refresh the stored owner and name, no state change (E65) |
| `301`, any other target | Issue transferred | Link `gone`, reason `moved` (E2, E65) |
| `301`, unclassifiable `Location` (another scheme, host or port included) or a second `301` in one attempt | Unclear | GitHub unavailable, never `moved` or `gone` (E65) |
| `403` on a push | Read-only credential or archived repository | E5 and E21, unchanged |
| Repository Unavailable | Repository deleted or lost to the credential | Links and markers untouched, not `gone` (E27) |

- **Addressing.** Reads and pushes use the documented `/repos/{owner}/{name}/issues/{number}` with the repository's stored owner and name, and never follow a redirect automatically (a `Location` off `https://api.github.com` is not followed and carries no credential, [security.md](security.md#redirects-never-carry-a-credential-off-github)); a `301` is classified by its `Location` as in the table (E65). The id form is reached only through GitHub's own redirect: Kerghan never builds an id-path URL, because that path is not in GitHub's REST reference and its removal would make every read answer `404` and look like a mass deletion. A rename refreshes the stored owner and name, an outcome owned by Repositories and reached through an event or service call.
- **Normalized outcomes only.** The link layer and the sync service see only ok, `deleted`, `moved`, not found, unavailable, rate limited and credential results. URLs, status codes and redirect headers stay in the provider adapter, so a future provider is a new adapter. The addressing scheme is never a user setting: all current credential types call the same GitHub API.
- The Integrations client gains `moved`, `gone` (`410`) and an adapter-internal `renamed` outcome; the operations (`getIssue`, `updateIssue`, `probeIssues`) and their result kinds are in [sync.md](sync.md#github-issue-client-operations); `renamed` stays inside the adapter.
- **Contract spec.** A recorded contract spec ([testing.md](testing.md#fixtures)) records the `200`, `404`, `410` and `301` answers, including the rename redirect and its `Location` form, and is runnable against live GitHub on demand. The `Location` of a transferred issue has not been observed yet: the spec must record it, and until then "any other target means moved" is an assumption.
- **The `gone` guard.** A `404` sets `gone` only after the probe answers `200` with the same credential; a failing probe is access loss (E19 path) and keeps the marker. The probe runs only after a `404`. A credential with metadata permission only reads the repository but gets `404` on every issue, so a repository read would turn every link `gone`; the issues probe does not. A transfer to a repository the credential cannot read also answers `404` and is labelled `deleted`.
- Setting `gone` and deleting the marker is one transaction in lock order. The edit path locks the link row and creates a marker only while the link is not `gone` (E1 `(race)`).
- **Gone is left only by unlinking.** A gone link creates no marker, makes no push and no refresh, and its edits are local only (E1). The Kerghan issue is never deleted or closed. The GitHub issue id stays reserved by the unique index until the unlink. Kerghan never follows a transfer (E2).
- Pull requests are refused on attach and skipped on import and refresh (E3); GitHub never converts an issue to a pull request, so no state exists for it.

## Link states

- **Stored** in `status` (`varchar(32)`) plus a nullable `status_reason` (`varchar(32)`) ([model.md](model.md#issues_github_links)):

  | `status` | `status_reason` | Set by | Left by |
  |---|---|---|---|
  | `linked` | none | Link creation; any successful push or refresh | `gone` or `sync_failed` |
  | `gone` | `deleted`, `moved` | The rules above | Unlinking only |
  | `sync_failed` | `retries_exhausted`, `no_credential`, `credential_invalid`, `forbidden` [sync.md](sync.md#retries-and-sync_failed): `retries_exhausted` on the last transient attempt; `no_credential` when no integration resolves; `credential_invalid` on a `401` or when the candidates are not usable; `forbidden` on a `403` or a failed issues probe (E18 to E22) | A successful push that clears the marker; a successful refresh only when no marker exists; the retry sync action (resets to `linked` at once and enqueues); or `gone` |

  A refresh never clears a failure that belongs to an unsent write, so a read-only credential (which still reads, E5) cannot flip `forbidden` back to `linked` while the marker is unsent. `forbidden` is reached in one attempt, with no retry loop. The stored vocabulary and `gone` are decided here; the `sync_failed` reasons (final, four) and transitions are in [sync.md](sync.md#retries-and-sync_failed), and there is no "links by status" index in v1.
- **The GitHub App** is registered with Issues: write and Metadata: read ([security.md](security.md#the-github-app-gains-issues-write)). An installation whose owner has not yet accepted the updated permissions still reads, and a push with it ends in `sync_failed`, reason `forbidden`; link creation does not warn about a read-only credential.
- **Derived at read time, never stored:** *pending* (a marker exists), *rate limited until X* (in memory, E17) and *repository unavailable* (the repository's status). An edit never writes a status. There is no *paused* link state: a user who is not `approved` is signed out and cannot read it; only the worker-side pause remains (E24).
- **Precedence** when several apply: `gone`, `sync_failed`, repository unavailable, rate limited, pending, `linked`. A read exposes the primary state and the list of all that apply ([api.md](api.md#link-object)); #491 decides wording and placement. An unlinked issue has no state.
- Gone offers unlink and no retry sync; sync failed offers retry sync and, for a credential reason, a pointer to Integrations ([ui.md](ui.md)).

## Edge cases

The rows live in [edge-cases.md](edge-cases.md), the single index: E1 to E5 and E22 (gone, transferred, pull request, already linked, access loss) and E57 to E65 (link creation failures, attach confirmation, repository change, unlink, redirects). A change of outcome is made here first, then reflected there.

## Not decided

- Out of scope in v1: creating a GitHub issue from a Kerghan issue, bulk import, following transfers, labels, assignees, milestones, comments, pull requests as links, projects backed by several repositories.
- Rejected alternatives: asynchronous link creation (needs a "linking" state); Kerghan's values winning on attach (can destroy remote content); a URL as identifier (one more refusal case); following a transfer (a link would leave the project's repository); a manual refresh reviving a gone link (a second exit, more tests; the issues probe already guards against a false `gone`); "unlink all"; pushing before unlinking; the undocumented `/repositories/{id}/issues/{number}` path as primary address; a user-selectable addressing scheme per integration; a repository read as the `gone` guard; storing `synced` and `pending` (duplicates the marker, can disagree after a crash); encoding the reason in the status value.

## Open questions

None owned by #487. What remains is owned elsewhere:

- [x] Routes, payloads, refusal codes and how the states and confirmations are exposed: decided in [api.md](api.md) (#489).
- [ ] Wording and placement of the states and confirmations. (#491)
- [x] Rendering of GitHub content: decided in [security.md](security.md#github-and-user-content) (#490).

The `200`, `404`, `410` and `301` answers, including the rename `Location`, are recorded by the contract spec of [testing.md](testing.md#fixtures); the `Location` of a transferred issue is still to be recorded there.

## Compatibility, performance and security

- Nothing shipped changes: `status_reason` is added to a table that is not built yet, and the repository-change rule is replaced before any implementation exists.
- Link creation costs one GitHub read in the request, bounded by the Integrations client's timeout and rate-limit handling; unlinking costs no GitHub call.
- A not-found answer never reveals whether an issue exists beyond what the owner's credential can read. The owner's credentials do all GitHub work, never the browser. GitHub content and credentials never appear in logs or job params (ids only). A link or unlink never crosses users (the link's `user_id` is for uniqueness only).

## Required tests

Tiers follow [testing.md](testing.md#tiers): unit on the sync service with the fake GitHub client for the failure mapping, e2e for the attach, unlink and repository-change answers, `(db)` for the unique indexes, the project-row lock race and unlink cleanup. The unique indexes and link cleanup are also in [model.md](model.md#required-tests).

- Import creates a Kerghan issue with GitHub's values; attach replaces the local values only with the confirmation, a stale `updated_at` is refused with `409 ISSUE_ATTACH_CONFIRMATION_REQUIRED` and the differences (`issues.updated_at` is `datetime(3)`, so an edit in the same second as the warning is caught), equal values need none, writes nothing to GitHub and creates no marker (E61); a closed GitHub issue is stored as `closed`.
- A project with no repository cannot link; link creation is refused with no GitHub call while the repository is Unavailable and allowed while Unknown; the issue number is read in the project's repository and must be a positive integer; the GitHub read happens outside the transaction and a repository changed in between is refused as retryable (E62); after creation the base equals the local columns (normalization invariant).
- A pull request is refused on attach and import with `422 GITHUB_ISSUE_IS_PULL_REQUEST` (E3); an already linked GitHub issue (`409 GITHUB_ISSUE_ALREADY_LINKED`, E4, E46 `(db)`) and an already linked Kerghan issue (`409 ISSUE_ALREADY_LINKED`, E64) are refused. Two users may link the same GitHub issue (E45).
- Failed link creation stores nothing, creates no job and never waits: not found, `410`, `301` that is not a rename (`404 GITHUB_ISSUE_NOT_FOUND`, E57), rate limited (`503 GITHUB_RATE_LIMITED`, E58), no integration, `401`, `403` (`409 GITHUB_CREDENTIAL_UNUSABLE`, E59), timeout, network error, `5xx` (`502 GITHUB_UNAVAILABLE`, E60).
- Changing or detaching a repository is allowed at zero links and refused with `409 PROJECT_HAS_LINKS` and the link count otherwise; a concurrent link creation is never left against a changed repository `(db)` (E62).
- Unlinking deletes the link and its marker, keeps the issue, makes no GitHub call and frees the GitHub issue (E47); it is refused without the confirmation while a marker exists, and with it the marker is discarded (E63); it works in every state; another user's or a deleted project answers `404`; an in-flight push is a no-op (E44) `(race)`; unlinking an unlinked issue is a distinct `409 ISSUE_NOT_LINKED` refusal (E64).
- A deleted issue (`404` with a passing probe, `410`) and a transferred one (a `301` to another repository) make the link `gone` with reason `deleted` or `moved` (E1, E2); a `404` with a failing probe does not (E22); a gone link creates no marker, makes no push or refresh and leaves only by unlinking; an edit racing the job that sets `gone` leaves no marker on the gone link (E1 `(race)`).
- A rename `301` retries once at the `Location`, refreshes the stored owner and name and changes no state; an unclassifiable `Location` (including another host) or a second `301` is GitHub unavailable, never `moved` or `gone`, and no credential is sent off `api.github.com` (E65).
- `sync_failed` is left only by a push that clears the marker, a refresh with no marker, the retry action (which resets to `linked` at once and enqueues) or `gone`; a refresh never clears a failure of an unsent write; `forbidden` is reached in one attempt.
- `NULL` and `''` compare equal, a blank body is stored as `NULL` and nothing else is normalized (sync spec: [sync.md](sync.md#required-tests)).
- The `200`, `404`, `410` and `301` answers and the rename `Location` are covered by the contract spec ([testing.md](testing.md#fixtures)).
- Deleting a project releases its links and frees their GitHub issues.
