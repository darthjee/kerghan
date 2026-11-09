# Issue: Specs: fold the repositories specs into the permanent docs and remove them

## Description

Part of Epic #444 (repositories listing). This is the Epic's **last** sub-issue: it folds the lasting content of `docs/agents/specs/repos/` into the permanent docs and then deletes the spec folder, following the lifecycle in `docs/agents/specs.md` (step 3 and step 4).

**Blocked:** do not start until every implementation sub-issue of #444 is merged (they are added to #444 after the spec enhancements #445–#451).

Highlights of the fold (the full list is the README checklist; see [Scope](#scope)):

- `product.md` / `flow.md`: the per-user repo snapshot, the settled tracked-repo data model, the partly lifted "Deferred → integration credentials", and discovery/selection as built.
- A new Repositories module doc (hub + `sync.md` + `edge-cases.md`) and `backend/routes/repositories.md`.
- Integrations and Auth docs: `IntegrationsGithubService`, `integration.deleted`, `401 → invalid`, the installation-token cache, `github_handle`, `AccountHandleService`, `user.deleted`, the narrowed `409 DEFAULT_USER_MANAGED`.
- **Promote the "GitHub credentials stay in the backend" rule** into `architecture/security.md` as its own section, linked from `modules/integrations.md`, and reword `CLAUDE.md` / `AGENTS.md` to match.
- Delete `docs/agents/specs/repos/` and move its entry from "Active specs" to "Completed specs" in `docs/agents/specs.md`, pointing at the permanent docs, with product decision #444.

## Problem

While a feature is being built, `docs/agents/specs/repos/` (about 3,100 lines over 9 files) is its source of truth. Once the feature is built, the specs are temporary material: the permanent docs (`product.md`, `flow.md`, `modules/`, `backend/routes/`, `architecture/`, `environment-variables.md`) still describe Kerghan without repositories. The root instruction files also still say GitHub is read only by the browser, unauthenticated, which stops being true once the backend lists repos with integration credentials. Left as is, agents would read two diverging sources, or stale permanent docs.

## Expected Behavior

- No file under `docs/agents/specs/repos/` remains; `docs/agents/specs.md` lists the feature under "Completed specs", pointing at the permanent docs, with product decision #444.
- Every item of the README's "Product changes folded by #452" checklist is done or marked moot with a reason (see [Scope](#scope)).
- The Repositories docs follow the [Layout](#layout): `modules/repositories.md` (hub), `modules/repositories/sync.md`, `modules/repositories/edge-cases.md`, `backend/routes/repositories.md`, all linked from the indexes.
- The hard contracts were spot-checked against the code; the PR lists every mismatch and any issue opened for it (see [As built vs. spec drift](#as-built-vs-spec-drift)).
- `docs/agents/architecture/security.md` has the "GitHub credentials stay in the backend" section, linked from `modules/integrations.md`; `CLAUDE.md` and `AGENTS.md` are reworded (see [Backward compatibility and links](#backward-compatibility-and-links)).
- No `specs/repos` reference remains outside `docs/agents/issues/` and `docs/agents/plans/`; no Open marker remains; every relative link and anchor in the touched docs resolves.
- No code changes beyond comment-only edits that repoint spec citations.

## Solution

### Scope

#### What to fold: the README checklist is the source of truth

The authoritative list of fold destinations is the **"Product changes folded by #452"** checklist in `docs/agents/specs/repos/README.md`, not the destination list in the Description above, which is a summary only. The checklist is longer: it also covers `environment-variables.md`, `architecture/backend.md` (`#error-responses`, `#testing`), `architecture/infra.md`, `contributing.md`, `modules/integrations/github-app.md`, `backend/routes/auth.md`, and the `user.deleted` contract, among others.

- Implementation sub-issues that add fold work **extend the README checklist**, not this issue.
- When the fold starts, every checklist item is either **done**, or explicitly marked **moot** with a one-line reason (for example, a convention that did not generalise beyond Repositories).
- Destinations at a glance:

| Destination | Gets |
|---|---|
| `product.md`, `flow.md` | Persisted per-user repo snapshot, settled data model, partly lifted "Deferred → integration credentials", discovery/selection steps, answered open question |
| `modules/repositories.md` + `modules/repositories/` (new) | The module doc: hub plus `sync.md` and `edge-cases.md` (see [Layout](#layout)) |
| `backend/routes/repositories.md` (new) | The route contract from `api.md` |
| `modules/integrations.md`, `modules/integrations/github-app.md` | `IntegrationsGithubService` export, `integration.deleted`, `401 → invalid` compare-and-set, installation-token cache |
| `modules/auth.md`, `modules/auth/default-user.md`, `backend/routes/auth.md` | `github_handle`, `AccountHandleService`, `user.deleted`, narrowed `409 DEFAULT_USER_MANAGED`, `PATCH /auth/account.json`, `POST /auth/account/mine.json` |
| `architecture/security.md` | "GitHub credentials stay in the backend" section, linked from `modules/integrations.md` |
| `architecture/backend.md`, `architecture/frontend.md`, `architecture/infra.md`, `contributing.md` | `error.retryAfterSeconds`, the DB-backed test tier, the MySQL CI job, `Clock`/`SyncLauncher` if they generalised, the ESLint boundary override if it needs a mention |
| `environment-variables.md` | The `KERGHAN_REPOSITORIES_*` variables |
| `cache-warmer.md` | Where relevant |

#### Where the feature-wide spec files go

These follow the `modules/auth/user-approval.md` and `modules/integrations.md` precedent: the Repositories module doc holds them as sections, each placed next to the rules it covers.

- `ui.md` → a **"Frontend"** section of the Repositories module doc.
- `edge-cases.md` → `modules/repositories/edge-cases.md` (the matrix, each row linking to its rule; see [Layout](#layout)).
- `testing.md` and the per-file **"Required tests"** sections → a **"Testing"** section of the module doc (and of the other destination docs where the rule lives there).
- Cross-cutting conventions move to the architecture docs instead (the DB tier, and `Clock`/`SyncLauncher` if they apply beyond Repositories); the module doc links to them.

#### Out of scope

- **No code changes**, except comment-only edits that repoint source comments citing the specs (see [Backward compatibility and links](#backward-compatibility-and-links)). The fold documents the code as built. Where code and spec disagree, the fold records the built behaviour and opens a new issue for any fix. Code such as `core/error-codes.ts` is only cited, never edited.
- **Historical `docs/agents/issues/` and `docs/agents/plans/` files** that link into `specs/repos/` stay as they are: they are records. The "no link points at the deleted specs" check covers live docs only (everything outside `issues/` and `plans/`, plus `CLAUDE.md` / `AGENTS.md`).

### Layout

About 1,500 lines of Repositories-only content remain once `api.md` and the Integrations/Auth parts go to their own docs. That is twice the largest existing module doc, so the module doc is a **hub plus a folder**, like `modules/auth/` and `modules/integrations/`:

```
modules/
  repositories.md          hub: overview, data model (tables, statuses, logical FKs,
                           user deletion, private-metadata lifecycle, ownership),
                           security, frontend, testing, index
  repositories/
    sync.md                sources and handle credential, trigger, per-user lock,
                           Clock, SyncLauncher, lease recovery, pagination, write
                           path, partial failures, pruning, rate limits, ETags, values
    edge-cases.md          the edge-case matrix; each row links to its rule
backend/routes/
  repositories.md          the route contract, from api.md
```

- The hub's **Testing** section holds the module-wide strategy (tiers, fakes, harnesses). Each sub-doc ends with its own "Required tests", next to its rules.
- `backend/routes.md` and `docs/agents/index.md` (and `folder-structure.md`, if it lists module docs) link the new files.

### As built vs. spec drift

The implementation sub-issues are supposed to keep the specs in sync. The fold still checks before it moves anything, so the permanent docs describe the code as built.

#### Spot-check the hard contracts

Before folding, compare these against the merged code:

- routes, methods, request/response DTO fields, and status codes (`backend/routes/repositories.md`, `PATCH /auth/account.json`, `POST /auth/account/mine.json`);
- error codes (`core/error-codes.ts`, e.g. `REPOSITORY_SOURCE_UNUSABLE`, `DEFAULT_USER_MANAGED`), plus the `error.retryAfterSeconds` field;
- environment variable names and defaults (`KERGHAN_REPOSITORIES_*`);
- table and column names, types, and indexes (the five Repositories tables, `auth_users.github_handle`) against the migrations;
- event names and payloads (`integration.deleted`, `user.deleted`) and exported services (`IntegrationsGithubService`, `AccountHandleService`);
- the ESLint boundary override, the DB-backed test tier (`*.db-spec.ts`, `yarn test:db`), and the MySQL CI job;
- each route's cache class (`@CachePolicy`).

Prose rules (sync behaviour, edge-case outcomes, UI details) are trusted to the specs and folded as written.

#### On a mismatch

- The permanent doc describes the **built** behaviour.
- If the built behaviour looks wrong (a bug, a security gap, or a break from a product decision), open a **new issue** linked to #444 that cites the spec's original rule. The fold is never blocked on it.
- The #452 PR description lists every mismatch found and the issue opened for it, if any.

### Alternatives considered

**Chosen: one issue, one PR, in staged commits.** This matches every previous fold (#295, #366, #389, #402, #414, #424): the specs are deleted in the same PR that makes them redundant, so specs and permanent docs never coexist as two sources of truth. Suggested commit order:

1. The new Repositories docs: `modules/repositories.md`, `modules/repositories/sync.md`, `modules/repositories/edge-cases.md`, `backend/routes/repositories.md`, and the index links.
2. Integrations and Auth docs: `modules/integrations.md`, `modules/integrations/github-app.md`, `modules/auth.md`, `modules/auth/default-user.md`, `backend/routes/auth.md`.
3. Product and cross-cutting docs: `product.md`, `flow.md`, `architecture/security.md`, `architecture/backend.md`, `architecture/frontend.md`, `architecture/infra.md`, `environment-variables.md`, `contributing.md`, `cache-warmer.md`, and the `CLAUDE.md` boundary wording if needed.
4. Delete `docs/agents/specs/repos/` and move the entry to "Completed specs" in `docs/agents/specs.md`.

Rejected:

- **Split into fold sub-issues per destination group:** smaller PRs, but the specs and the permanent docs would coexist and drift in between.
- **Fold during implementation**, with each implementation sub-issue folding its own part: this changes the `specs.md` lifecycle, and the specs would stop being one coherent source of truth while the feature is half-built.

### Backward compatibility and links

#### Root instruction files

Once the feature ships, GitHub is read by the backend for repository listing, so `AGENTS.md` (the overview near line 11 and the note near line 108) and `CLAUDE.md` (the GitHub-credentials boundary) are reworded:

- **Repository listing** is fetched by the backend, inside the Integrations module, with an integration's credential or the GitHub handle's public listing.
- **Issue data** is still fetched by the browser, unauthenticated (public repos only).
- `CLAUDE.md` gains the **"GitHub credentials stay in the backend"** rule as a boundary: every GitHub call that uses a user's credential is made by the backend inside the Integrations module, and no endpoint returns a credential or anything derived from it beyond the masked `secretHint`.
- Root files still link only to `docs/agents/specs.md`, following its rule; the hub's "Completed specs" row points at `architecture/security.md`.

#### Link and leftover checks

- No `specs/repos` reference remains outside `docs/agents/issues/` and `docs/agents/plans/`. That includes `CLAUDE.md`, `AGENTS.md`, `navi/`, and source code.
- **Source comments** in `backend/` and `frontend/` that cite a spec file are repointed to the permanent doc that now holds the rule. This is a comment-only edit, the one exception to "no code changes".
- No `> **Open — settled by #NNN:**` marker and no "Open markers" table row remain.
- Every relative link and `#anchor` in the touched docs resolves, including links into sections renamed or split by the fold (e.g. in `modules/integrations.md`, `modules/auth/default-user.md`).

### Edge cases

#### Conditional checklist items: decided by usage at fold time

- **`Clock` / `SyncLauncher`:** promote them to `architecture/backend.md` only if code **outside** `backend/src/repositories/` uses them when the fold runs (e.g. the Integrations token cache or budget tracker using the `Clock`). Otherwise they stay in `modules/repositories/sync.md`. The "no `NOW()` / `CURRENT_TIMESTAMP` in SQL time conditions" rule goes wherever the `Clock` goes.
- **ESLint boundary override:** mentioned in `contributing.md` only if it changes what a contributor may import outside the Repositories module. Otherwise it appears only in the Repositories module doc's Security section.
- A skipped item is marked **moot** in the checklist with its reason (see [Scope](#scope)).

#### `user.deleted` without a deletion path

If no user-deletion path exists at fold time:

- document the built Repositories listener and the `UserDeletedEvent { userId }` contract as written;
- `modules/auth.md` carries a **"Not built yet"** note, following the `modules/integrations.md` precedent: whoever adds a deletion path must emit the awaited event after the delete commits, and must retry it or run an orphan sweep, because a failed listener only logs.

No new issue is opened for it.

#### A descoped implementation sub-issue

If an implementation sub-issue of #444 is closed without being built before #452 runs:

- its part is **left out** of the permanent docs;
- its decision is recorded as one line in `product.md` "What's still open", citing the closed issue and the spec section as of the last commit before deletion, so the definition is still reachable through git history.

### Testing

Verified manually by the maintainer on the PR. Out of scope: no automated link checker or doc tests are added.

## Benefits

- One source of truth for the built Repositories feature, organised like the other modules (hub + folder, routes doc, security section).
- Root instruction files and architecture docs match reality: credentials stay in the backend, repo listing happens server-side, and issue fetching stays in the browser.
- Spec drift is caught by checking the contracts at fold time, and any real defect becomes a tracked issue instead of being silently documented away.
- Closes Epic #444's spec lifecycle, leaving `docs/agents/specs.md` with no active spec for the feature.
