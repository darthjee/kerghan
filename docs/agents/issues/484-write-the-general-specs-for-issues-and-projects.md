# Issue: Write the general specs for Issues and Projects

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined first as specs, under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, following the lifecycle in `docs/agents/specs.md`. This is the first sub-issue of the epic: it writes the first version of the specs.

This issue is documentation only: no code, migrations, endpoints or frontend changes.

**Decisions already made in the epic**

- A project is the home of issues; every Kerghan issue belongs to exactly one project. A project may be about code or anything else.
- Project to repository: 0 or 1 linked repository (one of the user's repository rows). A project with no repository is a non-code project. Whether one repository may back several projects of the same user is open.
- Ownership: one user, private (another user's project answers 404). Sharing, members and roles are out of scope, but the spec must not make them impossible later.
- Creation: explicit (optionally picking an added repository, the only way to make a non-code project), plus a shortcut that creates a project from an added repository.
- Issue to GitHub issue: one to one, per user (unique on user and GitHub issue); the link is optional; it can be created from a GitHub issue or by attaching one to an existing Kerghan issue; the GitHub issue must belong to the project's linked repository.
- Sync is two-way; the details (fields, conflict rules, states) are decided in the enhancement issues.
- Workers (from #479, in-process, in-memory queues): on-demand triggers only; outbound writes use a durable pending marker in the database that is re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, and exhausted retries mark the link as sync failed; jobs receive ids only, and credentials stay in the Integrations module.
- `product.md` says issue data is not persisted by default; this epic changes that and the specs must say what is now stored.

## Problem

There are no specs for the feature, and implementation issues must not make their own decisions about the data model, API, security or UI (`docs/agents/specs.md`). Without a first version, the enhancement issues (#485 to #491, #493, #494) have nothing to refine, and the decisions already taken in the epic exist only in the issue text.

The spec convention in `specs.md` also says each feature has a `README.md` index. This epic uses `docs/agents/specs/issues.md` as its index instead, so the convention needs an exception, and the folder name `docs/agents/specs/issues/` collides in name (not in meaning) with `docs/agents/issues/`, which holds issue drafts.

## Expected Behavior

- `docs/agents/specs/issues.md` and the nine files in `docs/agents/specs/issues/` exist and link to each other. Every relative link and every anchor to a file's *Open questions* section resolves.
- Every decision listed above is written in the file that owns it, and every open point is marked as an open question with an existing owner issue.
- `docs/agents/specs.md` lists the feature under *Active specs*, and its Conventions section allows this layout and states that the fold issue deletes both `docs/agents/specs/issues.md` and `docs/agents/specs/issues/`.
- The index explains that `docs/agents/specs/issues/` is the spec folder and is unrelated to `docs/agents/issues/` (issue drafts).
- The index states that, until the specs are folded in, they supersede `product.md`'s statement that issue data is not persisted by default.
- The specs contain no real tokens, secrets, personal data or private repository names; examples use obviously fake values.
- No code, migrations or endpoints are added.

## Solution

**Layout.** `docs/agents/specs/issues.md` is the index, and the files are in `docs/agents/specs/issues/`: `model.md`, `projects.md`, `github-link.md`, `sync.md`, `api.md`, `security.md`, `ui.md`, `edge-cases.md`, `testing.md`. Each file ends with a "Required tests" section. Specs describe decisions, not code. The repositories precedent (#450, #451) kept an edge-cases matrix and a testing spec as their own files, and this epic does the same.

**Depth rule.** The first version records only the decisions already made in the epic. Everything else is listed under that file's `## Open questions` section with an owner. No proposed defaults and no invented detail. Each file lists, in Required tests, the checks that its current rules imply; the enhancement issues extend it. An index file has no Required tests section, and a file with nothing testable yet says so rather than inventing checks.

**Open questions format.**

- Each file has one `## Open questions` section, placed right before its "Required tests" section. A file with nothing open omits it.
- Each open point is a `- [ ]` item with the question and, in parentheses, the owner issue number, for example `- [ ] May one repository back several projects of the same user? (#485)`. A point with no owner is not allowed.
- The owning enhancement issue moves the decision into the body of the file and removes the item (or updates the owner if it keeps the point open).
- `issues.md` links to each file's *Open questions* section but does not copy the questions.
- Owners: `projects.md` (#485), `model.md` (#486), `github-link.md` (#487), `sync.md` (#488), `api.md` (#489), `security.md` (#490), `ui.md` (#491), `edge-cases.md` (#493), `testing.md` (#494).

**Content of each file.**

| File | First version contains | Required tests (from the rules already stated) |
|---|---|---|
| `issues.md` | Overview, purpose, a short glossary (project, issue, GitHub issue, link), scope in and out, the product decisions behind the feature, links to the nine files and to each file's *Open questions* section | none (index) |
| `projects.md` | The project as the home of issues; 0 or 1 linked repository; one private owner; explicit creation and the shortcut from an added repository | another user's project answers 404; a project without a repository can be created; a project can link one added repository |
| `model.md` | The entities (project, issue, GitHub link, pending marker), their relations, ownership by user, and the known constraint (link unique on user and GitHub issue) | the unique constraint on the link; a Kerghan issue holds at most one link |
| `github-link.md` | One to one per user; optional; created from a GitHub issue or by attaching one; the GitHub issue must belong to the project's repository | linking a GitHub issue from another repository is refused; a project with no repository cannot link; two users may link the same GitHub issue |
| `sync.md` | Two-way sync; on-demand triggers only; the durable pending marker re-enqueued at boot; rate limits via `retryAfterSeconds`, retry with cooldown, failed state; ids-only jobs; credentials stay in Integrations; the dependency on #479 | a restart does not lose a pending write; a job exhausting its retries marks the link failed; job params and logs carry no secrets |
| `api.md` | Principles only: user-scoped, another user's data answers 404, thin controllers, ids not secrets. Routes and payloads are open | another user's project or issue answers 404 |
| `security.md` | Ownership scoping, credentials stay in the Integrations module, no endpoint returns a credential beyond the masked `secretHint`, safe log fields | no credential in any response, job param or log |
| `ui.md` | The minimum: the pieces that must exist (project list, issue list, link state). Almost everything else is open | none yet beyond the existence of those views |
| `edge-cases.md` | Its purpose (a matrix of edge cases across projects, issues, the link and the sync, each with expected behavior, owning file and verifying check) and its open questions; no rows beyond cases already decided in the epic | none yet |
| `testing.md` | Its purpose (the test strategy: tiers, fixtures, how workers and security rules are tested) and its open questions | none yet |

**Scope.**

- In scope: create the index and the nine files, and edit `docs/agents/specs.md` only (the Conventions exception and the *Active specs* entry).
- Out of scope: `AGENTS.md` and `docs/agents/summary.md` stay unchanged, since they only describe the hub. `product.md` and every other permanent doc stay unchanged until the fold issue at the end of the epic. Resolving open questions is left to #485 to #491, #493 and #494. No code, migration, endpoint, frontend or GitHub-side change.

**Edge cases.**

- The Conventions exception must say the fold issue deletes both the index file and the folder, otherwise `issues.md` is left behind.
- The index states the name collision with `docs/agents/issues/` and the temporary contradiction with `product.md`.
- Every open question names an existing owner, and all relative links and anchors resolve.

**Security.** The credential rules of the project (credentials stay in the backend inside the Integrations module, no endpoint returns a credential or anything derived from it beyond the masked `secretHint`, the frontend never calls GitHub with a credential) are written into `security.md` and `sync.md` from the first version, so later issues cannot weaken them by omission. The detailed threat review is left to #490.

## Benefits

- The enhancement issues have a consistent, reviewable starting point, and the epic's decisions live in the repo, not only in an issue text.
- Open points are easy to find and each has an owner, so none is lost before the implementation is spawned.

## Notes

- Responsible agent: `architect`.
- Order of the epic's spec issues: #484, #485 to #491, #493, #494, then #492 (which spawns the implementation and the issue that folds the specs into the permanent docs).
- Performance: none, as nothing runs.
