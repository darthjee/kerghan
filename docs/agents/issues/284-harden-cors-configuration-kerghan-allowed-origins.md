# Issue: Harden CORS configuration (KERGHAN_ALLOWED_ORIGINS)

## Description
`KERGHAN_ALLOWED_ORIGINS` is listed in `.env.dev.sample` (`http://localhost:3000`) and referenced by `docs/agents/product.md` and the security agent as the CORS allowlist. However, the backend never reads it: `backend/src/main.ts` does not call `app.enableCors`, and `docs/agents/environment-variables.md` marks it (along with `FRONTEND_BASE_URL` and `NODE_ENV`) as *Reserved, not yet read*.

## Problem
The variable suggests a CORS policy exists when none does. Today the backend sends no CORS headers, so browsers deny cross-origin requests by default. The frontend is served same-origin through the proxy. If CORS is enabled without validation, a malformed value or an accidental `*` in production would be accepted silently. That risk is worse because authentication uses a cookie.

## Expected Behavior
- The backend resolves the CORS allowlist once at boot, via `ConfigService`:
  - If `KERGHAN_ALLOWED_ORIGINS` is set and non-empty, it is parsed as a comma-separated list of origins, with whitespace trimmed and empty entries rejected.
  - Otherwise, if `FRONTEND_BASE_URL` is set, the allowlist defaults to that URL's origin (`new URL(...).origin`), dropping any path.
  - If neither is set, CORS stays disabled (same-origin only, as today).
- Every explicit entry must be a well-formed origin (`http`/`https` scheme, host, optional port, and no path, query, fragment or trailing slash). A malformed value makes boot fail with a clear error naming the variable and the offending entry. An unparseable `FRONTEND_BASE_URL` also fails boot.
- Wildcard `*`:
  - When `NODE_ENV=production`, it fails boot.
  - Otherwise it is allowed. It must be the only entry, and it means "reflect any request origin". A literal `*` can't be combined with credentialed requests.
- When enabled, CORS uses `credentials: true` so the `access_token` cookie flows for allowed origins only.
- The expected format, the fallback order, and the production wildcard rule are documented.

## Solution
- Add a CORS config resolver/validator in `backend/src/core/`, following the existing `numeric-config.ts` / `mail.config.ts` pattern. It reads `KERGHAN_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL` and `NODE_ENV`, and returns either `undefined` (CORS disabled) or the options passed to `enableCors`. Cover it with Jest specs for valid lists, malformed entries, paths and trailing slashes, the wildcard in production vs. non-production, the `FRONTEND_BASE_URL` fallback, and the neither-set case.
- In `backend/src/main.ts`, call `app.enableCors(options)` when the resolver returns options. Keep `main.ts` thin.
- Documentation:
  - `docs/agents/environment-variables.md`: mark `KERGHAN_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL` (CORS fallback) and `NODE_ENV` (wildcard guard only) as **Consumed**, with the format and the source file.
  - Update the `.env.dev.sample` comment and `docs/agents/product.md` as needed.
- Security review: confirm `credentials: true` is never paired with an unrestricted origin in production.

## Benefits
- Turns an unenforced, misleading setting into a validated, fail-fast CORS policy.
- Prevents a permissive credentialed CORS policy from shipping to production, while keeping local dev flexible.
- Gives a sensible default through `FRONTEND_BASE_URL`, so production usually needs only one URL configured.
