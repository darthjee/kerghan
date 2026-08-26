# Add the routes index

Create `docs/agents/backend/routes.md` as a short index page for the new routes tree: one
sentence explaining what it is (per-endpoint reference for backend routes, one file per domain,
complementing the entity/event-focused `docs/agents/modules/` pages), followed by a link-only
list of documented domains, currently just:

- [Auth](routes/auth.md)

Follow the same terse, link-only style as `docs/agents/index.md`'s existing sections. Leave a
one-line note that future backend modules add their own entry here as they land (mirrors the
Expected Behavior note in `docs/agents/issues/31-document-routes.md`).

## Files to Change

- `docs/agents/backend/routes.md` — new file, index of documented route domains.
