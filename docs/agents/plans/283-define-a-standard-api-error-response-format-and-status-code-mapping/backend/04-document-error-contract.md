# Document the error contract

Add an `## Error responses` section to `docs/agents/architecture/backend.md` covering: the body shape
(with an example), where the filter lives and how it's registered (`APP_FILTER`), the status →
category-code table, the specific-code convention (`new XxxException({ message, code })` using
constants from `core/error-codes.ts`), the non-HTTP → generic `500` + logging rule, and the
enumeration-safety rule (uniform errors must not get distinguishing codes). Add a pointer to this
section from `docs/agents/architecture/frontend.md` (the frontend agent adds its own `ApiError`
notes there).

## Files to Change
- `docs/agents/architecture/backend.md` — new `## Error responses` section.
