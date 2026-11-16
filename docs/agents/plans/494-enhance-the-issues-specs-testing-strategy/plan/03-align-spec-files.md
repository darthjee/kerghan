# Align the per-concern spec files

In `sync.md`, `security.md`, `api.md`, `ui.md`, `github-link.md` and `projects.md`:

- Remove or resolve every mention of #494 as an open owner or as pending fixtures; point at [testing.md](testing.md) for the how.
- In each "Required tests" list, add an exception tag only where an item's tier would be misread (for example the real-engine items in `sync.md` get `(engine)`, concurrency items in `projects.md` get `(db)`, the access items in `security.md` and `api.md` point to the access matrix and the canary sweep).
- `ui.md`: add the frontend tests for the link and sync state views, the retry sync and unlink actions and the deletion confirmation, referring to testing.md's frontend section.
- Keep each file's own rules unchanged.

## Files to Change

- `docs/agents/specs/issues/sync.md`, `security.md`, `api.md`, `ui.md`, `github-link.md`, `projects.md` — pointers and tags only.
