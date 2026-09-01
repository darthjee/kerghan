# Backend Plan: Implement password recovery flow

Main plan: [plan.md](plan.md)

## Shared contracts

- `POST /auth/recover.json` always responds `200 { sent: true }` — the enumeration-safety
  contract; no branch-dependent status/timing difference.
- `POST /auth/reset-password.json` responds `200 { reset: true }` on success, **`400`** (never
  `401` — see `plan.md`'s "Shared contracts") on every rejection reason, via
  `BadRequestException('Invalid or expired token')`.
- Both routes set the `X-Skip-Cache` response header (same `SKIP_CACHE_HEADER` constant already
  used by `login`/`register`/`refresh`/`logoff` in `auth.controller.ts`), since Tent's
  `default_proxy` rule caches any `2xx` `*.json` response by query-string-only key regardless of
  method — `reset-password.json`'s response varies by outcome, so it must never be cross-served
  between callers.
- The `PasswordRecoveryRequestedEvent` payload's `resetUrl` is
  `${FRONTEND_BASE_URL}/#/recover-password?token=<token>` (`FRONTEND_BASE_URL` read via
  `ConfigService`, already declared in `.env.dev.sample`, currently unused elsewhere in
  `backend/src`). The path segment `recover-password` and query key `token` must match
  `frontend`'s route registration exactly.

## Steps

- [01 — Token model and event](backend/01-token-model-and-event.md)
- [02 — Recover endpoint](backend/02-recover-endpoint.md)
- [03 — Reset-password endpoint](backend/03-reset-password-endpoint.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`) and `npm run lint` (CI job:
  `backend_checks`) — both run with `backend/` copied to the job root (see
  `.circleci/config.yml`'s `Set folder` step), so run them the same way locally: `cd backend &&
  npm run coverage` / `npm run lint`.

## Notes

- No account-eligibility/banned-state concept exists in Kerghan today, so `reset-password.json`
  has nothing to check beyond token validity (confirmed against `docs/agents/product.md`).
- Rate limiting/abuse-prevention on `recover.json` is explicitly left unspecified by the issue —
  no existing rate-limiting precedent exists elsewhere in `backend/src` to follow, so this plan
  does not add any; flag it to `security` during review if it's felt necessary.
- After this plan lands, the `security` agent should review the two new endpoints (new
  authentication-adjacent surface, user input handling) and the `cache` agent should confirm
  `X-Skip-Cache` is set on both — per `.claude/agents/architect.md`'s standing review triggers.
  Neither is a plan step here since both are read-only reviewers with no implementation work of
  their own for this issue.
