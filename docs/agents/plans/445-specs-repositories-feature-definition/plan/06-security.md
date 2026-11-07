# security.md

Create `docs/agents/specs/repos/security.md`.

Decided:

- **Credentials stay in the backend** — and inside the Integrations module: every GitHub call that uses a user's credential is made by the backend; no endpoint returns a credential or anything derived from it beyond the masked `secretHint`. State that #452 promotes this rule to `docs/agents/architecture/security.md` as its own section.
- **User scoping:** every query filtered by the session user id; `404` for another user's repo; admins have no access (same rule as integrations).
- **Add verification** with GitHub, so a guessed `github_id` cannot add a repo or reveal its metadata.
- **Private metadata lifecycle** (link to model.md).
- **GitHub handle:** validated against GitHub's username format and URL-encoded when used (details open, #449).
- **Fixed GitHub base URL** (`https://api.github.com`), no user-controlled host or path — no SSRF surface.
- **CSRF:** state-changing routes are POST, covered by `OriginGuard` (`docs/agents/architecture/security.md`).
- **No secrets in logs or errors;** GitHub error bodies never echoed.
- **Abuse/performance:** one sync per user, Refresh cooldown, page cap, rate-limit stop (link to sync.md).

Open markers: handle validation details (#449); Integrations interface guarantees (#448); exact error codes (#446).

End with **Required tests** for each rule above.

## Files to Change
- `docs/agents/specs/repos/security.md` — new.
