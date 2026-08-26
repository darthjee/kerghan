# Cross-link modules/auth.md

Add one line to `docs/agents/modules/auth.md`'s existing "## Routes" section (right above or
below its summary table) linking to the new detailed page:

```markdown
See [Auth routes](../backend/routes/auth.md) for the full per-endpoint reference (request/response
detail, HTTP status, source files).
```

Do not remove or rewrite the existing summary table — per the discuss-issue dialogue on #31, the
two pages intentionally keep some duplication rather than merging.

## Files to Change

- `docs/agents/modules/auth.md` — add a one-line cross-link from the "## Routes" section to the
  new `docs/agents/backend/routes/auth.md` page.
