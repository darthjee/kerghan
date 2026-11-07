# model.md

Create `docs/agents/specs/repos/model.md` — the data model owned by a new **Repositories** backend module.

Decided (write as rules):

- **`repositories`** (per user, every GitHub repo seen in a sync, no separate "remote repo" entity): `id`, `user_id`, `github_id` (stable key), `owner`, `name`, `private`, `added_at` (nullable; null = not added), `integration_id` (nullable access link, set on Add), `last_seen_at`, `created_at`, `updated_at`. Unique (`user_id`, `github_id`). Renames followed through `github_id`.
- **Sources table** (e.g. `repository_sources`): which sources returned the repo in the latest sync — one row per (repository, integration) plus a "public handle" marker.
- **Per-user sync state**: `last_synced_at`, sync state (`idle` / `syncing`), per-source status of the latest sync (ok, error, invalid credentials, rate limited, page cap reached).
- **`auth_users.github_handle`**: nullable, owned by the Auth module.
- **Row statuses:** Added, Not added, Unavailable (added; every source that used to return it synced successfully and none returned it), Unknown (added; its only sources failed).
- **Logical FKs only** (`user_id` → `auth_users`, `integration_id` → `integrations`), per `docs/agents/architecture/modular-pattern.md`; no cross-module JOIN.
- **Private metadata lifecycle:** when an integration is deleted, its source rows go and `integration_id` is cleared; not-added repos left with no source are deleted; added repos stay (unavailable).
- **Ownership:** one user per row; two users seeing the same repo get independent rows.

Open markers: exact names/types/indexes and ETag storage shape (#447); pruning rule details for not-added repos (#447); deletion-hook mechanism (#448); user-deletion cleanup path (#450); `github_handle` type/validation/normalisation (#449).

End with **Required tests** for the decided rules (uniqueness per user, rename following, added/not-added, unavailable vs unknown, logical-FK cleanup on integration deletion, private metadata purge, per-user isolation).

## Files to Change
- `docs/agents/specs/repos/model.md` — new.
