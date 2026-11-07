# README and Active specs entry

Create `docs/agents/specs/repos/README.md`, modelled on the autocomplete README (#425):

- Title **Repositories**; one-line intro: temporary feature specs for listing a user's GitHub repositories and adding them to Kerghan; product decision #444; link to [Feature Specs](../../specs.md).
- **Overview:** the listing (merged sources: every integration plus the public repos of an optional GitHub handle), added / not added / unavailable / unknown, the Add button, user-scoped; foundation for later per-repo features.
- **Scope** (in / out), copied from #444's Scope: out of scope = removing repos, adding by `owner/name`, issues/label rules/triage, org-wide tracking, scheduled sync/polling, webhooks, and the permanent docs (folded in by #452).
- **Decisions summary:** one bullet per #444 decision, each linking the spec file that holds it (backend-only GitHub calls; merged listing; GitHub handle; one per-user `repositories` table with `added_at` + sources table + sync state; logical FKs; async sync when stale or on Refresh; paginated API from the DB; partial failures + `401 → invalid`; Add re-checked with GitHub; credentials stay inside the Integrations module; UI placement).
- **Sub-issues** table: #445–#452 (issue, title, spec files it touches), with a note that implementation sub-issues are added to #444 later and listed here when created.
- **Order:** #445 → #446 → #447 → #448 → #449 → #450 → #451 → implementation sub-issues → #452; the spec-enhancement sub-issues edit the same folder, so they go one at a time.
- **Open markers:** the convention (`> **Open — settled by #NNN:** …`), that each sub-issue removes its own markers and rows, that #452 checks none remain, and the table of every marker (filled in step 08 once all files exist).
- **Index:** links to `model.md`, `sync.md`, `api.md`, `integrations.md`, `security.md`, `ui.md` with a one-line description each.

Then edit `docs/agents/specs.md` "Active specs": replace `none` with an entry for **Repositories** linking `specs/repos/README.md` and product decision #444 (keep the existing "When no feature is in progress…" sentence).

## Files to Change
- `docs/agents/specs/repos/README.md` — new.
- `docs/agents/specs.md` — "Active specs" entry.
