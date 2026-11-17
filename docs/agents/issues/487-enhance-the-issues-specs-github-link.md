## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

It enhances `docs/agents/specs/issues/github-link.md`: it resolves the file's open questions and makes it precise enough for an implementation issue to build against without making its own decisions.

## Problem

`github-link.md` fixes only the shape of the link (one to one per user, optional, same repository, gone state in outline). It leaves open how a link is created and what values win, what unlinking does, what GitHub really answers for a deleted or transferred issue, which link states exist, and what a failed link creation looks like. It also says changing a project's repository is refused in v1 because unlinking was not defined.

## Expected Behavior

`github-link.md` has no unresolved open question owned by #487, a "Required tests" section that matches its rules, and related spec files that are consistent with it. No code, migrations or endpoints are added.

## Solution

Edit `docs/agents/specs/issues/github-link.md` and keep the other spec files consistent in the same PR. Decisions (outcomes only; routes, payloads and exact refusal codes stay with #489).

### Creating a link

- **Two ways, one service method.** *Import* creates a new Kerghan issue from a GitHub issue; *attach* links a GitHub issue to an existing, unlinked Kerghan issue.
- **Synchronous read.** The request makes one `GET` of the GitHub issue with the project owner's credential (inside the Integrations module), validates it and stores the link in one transaction. No job and no marker, so no half-done "linking" state; a refusal is immediate.
- **Identifier.** The API takes the **issue number in the project's repository**; the repository is always the project's, so the same-repository rule is structural (a pasted URL is parsed into a number by the UI, which refuses another repository). The stored `github_issue_id` comes from GitHub's answer.
- **Validation** (all before any write): the project has a repository that is not Unavailable; the issue exists and is readable; it is not a pull request (E3); it is not already linked by this user (E4, E46: the unique index decides races); the Kerghan issue (attach) has no link yet.
- **GitHub's values win, with confirmation.** On attach the local title, body and state are replaced by GitHub's and the base snapshot equals them, so attach never writes to GitHub and creates no marker. The request needs an explicit confirmation when the local values differ from GitHub's (the UI warns first). Import takes GitHub's values and needs no confirmation. A closed GitHub issue is allowed and stored as `closed`.
- **One at a time.** No list call, bulk import or pagination in v1; a bulk import can later reuse the same method.

### Same-repository rule and repository changes

- A project with no repository cannot link (`409`). Link creation is refused (no GitHub call) while the repository is Unavailable and allowed while it is Unknown, the same gating as sync ([projects.md](projects.md#linked-repository-unavailable-or-removed)); a dangling repository reads as Unavailable.
- **Changing or detaching a repository is allowed only while the project has zero links**; with any link it is refused with `409` carrying the link count (the user unlinks first). This replaces v1's blanket refusal, so `projects.md` ("Changing a project later", its "Not decided" item and required tests) and `api.md` are updated in the same PR. The change keeps the attach checks (an added repository of the caller, no other live project of the user on it) and never syncs.
- **No race.** Link creation and the repository change both lock the project row first (the module's lock order already starts with projects) and re-check inside the transaction, so a link is never created against a repository that has just changed. The link still needs no `repository_id`.

### Unlinking

- **Who:** the project's owner, through the single access check (another user's or a deleted project answers `404`).
- **When:** in any link state, including gone, sync failed and repository Unavailable. Unlinking never makes a GitHub call.
- **Effect,** in one transaction in lock order (project, issue, link, marker): the link row and its marker are deleted. The Kerghan issue is kept as it is, GitHub is never touched, and the GitHub issue is freed (this user may link it again, from this or another project, E47).
- **Unsent changes need a confirmation.** If a marker exists the request must carry an explicit confirmation, otherwise it is refused with `409` saying unsent changes exist; with it the marker is discarded and the response says changes were dropped. Pushing first is rejected (it needs GitHub and a working credential exactly when they fail).
- An in-flight push finds no link or marker and is a no-op (E44). Unlinking an issue with no link is not a success but a missing resource (the code is #489's).
- Relinking is a new attach, so local edits made after the unlink are replaced after confirmation. One issue at a time: no project-level "unlink all" in v1. No history or audit of unlinks.

### Gone, transferred and repository unreachable

| GitHub answers | Meaning | Outcome |
|---|---|---|
| `404`, repository readable with the same credential | Issue deleted | Link `gone`, reason `deleted` (E1, E22) |
| `410` | Issue deleted, or issues disabled on the repository | Link `gone`, reason `deleted` (the label says only that it is no longer available on GitHub) |
| `404`, repository not readable | Access lost | Not `gone`; follows E19, the marker is kept (E22) |
| `301` | Issue transferred | Link `gone`, reason `moved` (E2) |
| `403` on a push | Read-only credential or archived repository | E5 and E21, unchanged |
| Repository Unavailable | Repository deleted or lost to the credential | Links and markers untouched, not `gone` (E27) |

- **By repository id.** Reads and pushes of a linked issue address the repository by its stable GitHub id (`/repositories/{id}/issues/{number}`), so a rename or transfer of the repository never redirects and any `301` means the issue moved. The implementation proves the id-based path in a recorded contract spec; fallback if GitHub does not honour it: owner/name URLs and, on a `301`, a re-read of the repository by id (a changed full name is a rename, no state change; otherwise a transfer).
- The Integrations client gains a distinct `moved` result (`301`, today `unavailable/redirect`) and `gone` result (`410`); operation names and the other result kinds are #488's.
- **Gone is left only by unlinking.** A gone link creates no marker, makes no push and no refresh, and its edits are local only (E1). The Kerghan issue is never deleted or closed. The GitHub issue id stays reserved by the unique index until the unlink. Kerghan never follows a transfer (E2).
- Pull requests are refused on attach and skipped on import and refresh (E3); GitHub never converts an issue to a pull request, so no state exists for it.

### Link states

- **Stored** in `status` (`varchar(32)`) plus a new nullable `status_reason` (`varchar(32)`), added to `model.md` in the same PR:

  | `status` | `status_reason` | Set by | Left by |
  |---|---|---|---|
  | `linked` | none | Link creation; any successful push or refresh | `gone` or `sync_failed` |
  | `gone` | `deleted`, `moved` | #487 | Unlinking only |
  | `sync_failed` | `retries_exhausted`, `no_credential`, `credential_invalid`, `forbidden` | #488 (E18 to E21) | A successful push or refresh, or the retry sync action; or `gone` if a later read says so |

  #488 may add reasons to the same column in its own PR; #487 fixes only `linked`, `gone` and its two reasons.
- **Derived at read time, never stored:** *pending* (a marker exists), *rate limited until X* (in-memory, E17), *repository unavailable* (the repository's status) and *paused* (user not `approved`, E24). An edit never writes a status.
- **Precedence** when several apply: `gone`, `sync_failed`, repository unavailable, paused, rate limited, pending, `linked`. A read exposes the primary state and the list of all that apply; #489 and #491 decide wording and placement. An unlinked issue has no state.
- Gone offers unlink and no retry sync; sync failed offers retry sync and, for a credential reason, a pointer to Integrations ([ui.md](ui.md)).

### Edge cases

A failed link creation stores nothing, creates no job and never waits. New rows for `edge-cases.md` (ids continue after E56, each a required test):

| # | Case | Expected behavior | Status |
|---|---|---|---|
| E57 | Link creation: the issue is not found, `410` or `301` | Refused as not found; nothing stored, no job | Contract |
| E58 | Link creation while rate limited | Refused with `retryAfterSeconds`; nothing stored, no job, no wait | Contract |
| E59 | Link creation with no usable integration, a `401` or a `403` | Refused with the credential reason; a `401` invalidates the integration, a `403` does not; a handle alone is not enough (E20) | Contract |
| E60 | Link creation with a timeout, network error or `5xx` | Refused as GitHub unavailable; nothing stored | Contract |
| E61 | Attach where local values differ from GitHub's | Refused without the confirmation; with it local values are replaced, no marker, no GitHub write | Contract |
| E62 | Repository change or detach with links, and the race with a link creation | Refused with `409` carrying the link count; a concurrent link is never left against a changed repository | Contract |
| E63 | Unlink with unsent changes | Refused without the confirmation; with it the marker is discarded and the response says so | Contract |
| E64 | Attach to an already linked Kerghan issue, or unlink an issue with no link | Both refused, never silent | Contract |

Existing rows updated: E1 and E2 name the states (`gone`, reason `deleted` or `moved`); E3 gains "refused on attach and import"; the open "state names" questions of `edge-cases.md` and `github-link.md` are closed.

### Scope, alternatives, compatibility, performance and security

- **In scope for `github-link.md`:** the topics above. **Owned elsewhere:** synced fields, conflicts, retry values and `sync_failed` transitions (#488); routes, payloads and refusal codes (#489); encryption, retention, quotas and rendering of GitHub content (#490); wording and placement (#491); code and migrations (#492). **Out of scope in v1:** creating a GitHub issue from a Kerghan issue, bulk import, following transfers, labels, assignees, milestones, comments, pull requests as links, projects backed by several repositories.
- **Alternatives rejected:** asynchronous link creation (needs a "linking" state); Kerghan's values winning on attach (can destroy remote content); a URL as identifier (one more refusal case); following a transfer (a link would leave the project's repository); a manual refresh reviving a gone link (a second exit, more tests; E22 already guards against a false `gone`); "unlink all" (bulk confirmation, extra endpoint); pushing before unlinking; storing `synced` and `pending` (duplicates the marker, can disagree after a crash); encoding the reason in the status value.
- **Backward compatibility:** nothing shipped changes. `status_reason` is added to a table that is not built yet, and the repository-change rule of `projects.md` and `api.md` is replaced before any implementation exists.
- **Performance:** link creation costs one GitHub read in the request (bounded by the Integrations client's timeout and rate-limit handling); unlinking costs no GitHub call.
- **Security:** a not-found answer never reveals whether an issue exists beyond what the owner's credential can read; the owner's credentials do all GitHub work, never the browser; GitHub content and credentials never appear in logs or job params (ids only); an unlink or link never crosses users (the link's `user_id` is for uniqueness only). Rendering of GitHub content stays with #490.

### Required tests

`github-link.md`'s "Required tests" is rewritten to match the rules above. Tiers follow [testing.md](testing.md): unit on the sync service with the fake GitHub client for the failure mapping (E57 to E61), e2e for the attach, unlink and repository-change answers, DB-backed `(db)` for the unique indexes, the project-row lock race (E62) and unlink cleanup, plus a recorded contract spec for the id-based path and the `301`, `404` and `410` answers (the fidelity contract of `testing.md`). Each row E57 to E64 gets a tier in `edge-cases.md`.

## Benefits

- An implementation issue can build link creation, unlinking and the link states without making its own decisions.
- The gone, transferred and credential-loss outcomes are fixed before any code depends on guesses about GitHub.
- Repository mistakes become fixable once links are removed.

## Acceptance criteria

- `github-link.md` has no unresolved open questions owned by #487, or lists any that remain with the reason and the issue that will settle them.
- The "Required tests" section matches the rules in the file, and `edge-cases.md` has E57 to E64 with tiers.
- `projects.md`, `api.md`, `model.md` (`status_reason`), `sync.md`, `ui.md`, `security.md`, `testing.md` and `edge-cases.md` are consistent with it, with no remaining "#487 decides" statements.
- No code, migrations or endpoints are added.

## Notes

Responsible agent: `architect`. Builds on the model spec.
