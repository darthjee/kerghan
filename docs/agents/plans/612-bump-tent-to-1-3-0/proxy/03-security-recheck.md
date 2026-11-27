# Security recheck and security.md

Re-verify the five Tent behaviours from the issue's Security recheck table against `darthjee/tent:1.3.0` and record a pass/fail verdict per row in the PR description.

1. **Code review** of Tent 1.0.3 → 1.3.0 (changelog, plus the sources inside the images under `/var/www/html/`): `ProxyRequestHandler` header forwarding (row 1); the `default_proxy` built-in middlewares' `Host` → `X-Forwarded-Host` rewrite (row 2); default middleware chain and ordering relative to rule middlewares, and any `X-Forwarded-For` handling (row 3); the cache layer's `skip_cache_header` handling and cache key (row 4); response-header handling, `Set-Cookie` emission and whether cached responses store `Set-Cookie` (row 5).
2. **Live check**, once, against the dev stack on 1.3.0: forged `X-Forwarded-For` → backend sees only the socket address (row 3); cross-site `POST` to a `*.json` route → `403` (rows 1, 2); a `user-scoped` endpoint as two different users → neither gets the other's response (row 4); `login.json` → `Set-Cookie` attributes intact, not replayed on a later request (row 5).
3. **Docs.** In `docs/agents/architecture/security.md` (~line 67) change "verified in the `darthjee/tent:1.0.3` image's `ProxyRequestHandler`" to 1.3.0, and widen the note to list all five assumptions (header forwarding, `Host` rewrite, single-entry `X-Forwarded-For`, `skip_cache_header` / cache key, `Set-Cookie` passthrough) with "recheck all five on a Tent upgrade". If `docs/agents/architecture/proxy.md` or `docs/agents/standalone/inner-stack.md` restate any of these as version-specific, align them.
4. A failing row is fixed in this PR (extension or configuration), under the same rule as step 01; a Tent defect blocks the bump (see Notes in [proxy.md](../proxy.md)).

## Files to Change

- `docs/agents/architecture/security.md` — verified version and the five assumptions.
- Any extension or configuration file a failing row requires.
