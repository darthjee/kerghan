# Update env-var docs
Change these rows in `docs/agents/environment-variables.md`:
- `KERGHAN_ALLOWED_ORIGINS`: set to **Consumed**, optional. Document the comma-separated bare origins (`scheme://host[:port]`, with no path or trailing slash), that the value takes precedence over `FRONTEND_BASE_URL`, that `*` is dev-only (rejected when `NODE_ENV=production`), and that CORS is disabled when both variables are unset. Source: `backend/src/core/cors-config.ts`, `backend/src/main.ts`.
- `FRONTEND_BASE_URL`: set to **Consumed**. It is used for password-reset links (`backend/src/auth/password-reset.service.ts`, a stale doc until now) and as the CORS allowlist fallback (its origin).
- `NODE_ENV`: set to **Consumed**, optional. It is used only to reject the CORS wildcard in `production`, and the cookie flags remain environment-independent.

Refresh the `KERGHAN_ALLOWED_ORIGINS` mention in `docs/agents/product.md` if it needs a pointer to the format. Leave the `.env.dev.sample` value (`http://localhost:3000`) as is, since it is already valid.

## Files to Change
- `docs/agents/environment-variables.md` — status, format, and source for the three variables.
- `docs/agents/product.md` — optional pointer to the format.
