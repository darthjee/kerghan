# Update summary.md and index.md

Add the new routes doc to both hub pages, in their "Architecture" section (alongside the
existing "Modules" bullet):

`docs/agents/summary.md` — a new bullet under "## Architecture":

```markdown
- **[Routes](backend/routes.md)** — Per-endpoint backend route reference, one file per domain
  under `backend/routes/` (`auth.md` today), complementing the entity/event-focused
  `modules/` pages.
```

`docs/agents/index.md` — a new link under "## Architecture":

```markdown
- [Routes](backend/routes.md)
```

## Files to Change

- `docs/agents/summary.md` — add a "Routes" bullet under "## Architecture".
- `docs/agents/index.md` — add a "Routes" link under "## Architecture".
