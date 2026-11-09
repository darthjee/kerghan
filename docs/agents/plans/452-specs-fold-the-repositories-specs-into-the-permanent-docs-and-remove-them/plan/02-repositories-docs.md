# New Repositories docs

Commit 1: create the Repositories docs as built, using the step-01 findings. Write them as permanent docs, not specs: present tense, describing the built behaviour, with no "Open" or "settled by" wording and no links into `specs/repos/`.

- **`docs/agents/modules/repositories.md`** (hub, about 500 lines), shaped like `modules/integrations.md`:
  - Overview and module boundaries (imports only the Integrations/Auth exports);
  - Data model: the five tables, `source_key`, row statuses, logical FKs, user deletion (`user.deleted` listener), private-metadata lifecycle and pruning rule, ownership. From `model.md`, minus the `github_handle` parts that go to Auth.
  - Security: user scoping, Add verification, the module-boundary tooling, logging, abuse limits. From `security.md`; the "credentials stay in the backend" rule is linked, since it lives in `architecture/security.md`.
  - Frontend: navbar link, table, toolbar, sync UX, banners, empty states, handle field. From `ui.md`.
  - Testing: tiers, fakes, harnesses, launcher and clock, race tests, access matrix and canary sweep, frontend layers. From `testing.md` plus the hub-level "Required tests".
  - Index linking the sub-docs and `backend/routes/repositories.md`.
- **`docs/agents/modules/repositories/sync.md`:** everything from `sync.md` (sources, handle credential, trigger, lock, `Clock`/`SyncLauncher` unless promoted, lease recovery, pagination, write path, partial failures, pruning, rate limits and budget tracker, ETags, values), ending with its "Required tests".
- **`docs/agents/modules/repositories/edge-cases.md`:** the matrix from `edge-cases.md`, each row linking to its rule in the new docs.
- **`docs/agents/backend/routes/repositories.md`:** the route contract from `api.md` (routes, request/response, repo ref, sync state and polling, errors including `409 REPOSITORY_SOURCE_UNUSABLE` and the `not_found` source status, access rules, the Add rate limit), shaped like `backend/routes/integrations.md`.
- **Index links:** `docs/agents/backend/routes.md`, `docs/agents/index.md`, and `docs/agents/folder-structure.md` / `docs/agents/architecture.md` if they list module docs.

## Files to Change

- `docs/agents/modules/repositories.md` — new hub.
- `docs/agents/modules/repositories/sync.md` — new.
- `docs/agents/modules/repositories/edge-cases.md` — new.
- `docs/agents/backend/routes/repositories.md` — new.
- `docs/agents/backend/routes.md`, `docs/agents/index.md` (and `folder-structure.md` / `architecture.md` if applicable) — index links.
