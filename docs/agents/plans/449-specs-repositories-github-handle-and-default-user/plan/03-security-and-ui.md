# security.md and ui.md

`security.md` "GitHub handle": the exact validation and normalisation (link to `model.md`),
URL-encoding, no uniqueness (no cross-user signal), why a handle-only edit needs no current
password and is outside the abuse guard (not a credential, public data; no password oracle since
the password is never checked on that path), the narrowed default-user block, admins neither see
nor edit it, `mine.json` is user-scoped and `OriginGuard`-covered. Remove the #449 note; add
required tests.

`ui.md` "GitHub handle field": the separate section, prefill from `mine.json`, empty ⇒ clear,
validation and success messages, server error display, no current-password field, works for the
default user, admin pages unchanged. Update the empty-state link text if needed. Remove the #449
note; add required tests.

## Files to Change

- `docs/agents/specs/repos/security.md` — handle rules, tests.
- `docs/agents/specs/repos/ui.md` — handle field, tests.
