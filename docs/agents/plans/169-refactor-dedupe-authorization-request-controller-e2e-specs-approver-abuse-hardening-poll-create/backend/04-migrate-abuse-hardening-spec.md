# Migrate the abuse-hardening spec
Replace the outer scaffold with `useTestApp()`. Replace the per-IP create loop with `fillCreateLimit(ctx.app, { username: (i) => `rate-ip-${i}` })`, the local `fillUsernameLimit` with `fillCreateLimit(ctx.app, { username: () => username, ip: (i) => `203.0.113.${i}` })` (removing the local function), and every over-limit `toEqual({ uuid, pollToken, expiresAt })` block (2 in the per-IP test, 1 per per-username test) with `expectUniformCreateResponse(...)`. Leave the `concurrent open cap` block's own `capApp`/`capRepo` setup and the cool-off / DTO-length tests untouched. Drop unused imports.

## Files to Change
- `backend/src/auth/tests/authorization-request.controller.abuse-hardening.e2e-spec.ts` — use `useTestApp()`, `fillCreateLimit`, `expectUniformCreateResponse`.
