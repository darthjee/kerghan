# Backend Plan: Header and page need to react to login and logoff

Main plan: [plan.md](plan.md)

## Shared contracts

Must implement `POST /auth/status.json` exactly as specified in [plan.md](plan.md)'s
"Shared contracts" section: `@Public()`, `X-Skip-Cache` header set, body
`{ refreshToken: string }` (via the existing `RefreshTokenDto`), response always
`{ loggedIn: boolean }` — never a `401`, never a cookie, never a mutation.

## Implementation Steps

### Step 1 — Add a genuinely read-only token-validity check to `AuthService`

Add a new private helper, distinct from `#findActiveRefreshToken`
(`backend/src/auth/auth.service.ts:157-175`) — that existing method is **not**
side-effect-free: on finding a *revoked* token it calls
`#revokeTokenFamily(tokenRow.userId)` (lines 165-167) before throwing, which is the
correct behavior for `refresh()`'s replay-detection but would reintroduce the exact
multi-tab hazard this issue exists to avoid if reused here (Tab A rotates via a real
`refresh()`/`login()` call; Tab B's mount-time status check then presents the
now-revoked token and triggers family-wide revocation anyway).

Add e.g. `async #isActiveToken(refreshToken: string): Promise<boolean>`: hash the token
(reuse `#hashToken`), look up the row by hash, and return `true` only when the row
exists, `revokedAt` is `null`, and `expiresAt` is in the future. No `update` call, no
`#revokeTokenFamily`, no exception thrown for a missing/invalid token — just `false`.

Add the public method `async status(refreshToken: string): Promise<{ loggedIn: boolean }>`
that calls `#isActiveToken` and wraps the result. `refresh()` itself is unchanged — it
keeps using `#findActiveRefreshToken` exactly as today.

### Step 2 — Add the `POST /auth/status.json` route

In `backend/src/auth/auth.controller.ts`, add a new handler:

```ts
@Public()
@Post('status.json')
async status(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response): Promise<object> {
  res.set(SKIP_CACHE_HEADER, 'true');
  return this.authService.status(dto.refreshToken);
}
```

Reuses `RefreshTokenDto` (already imported) — no new DTO file needed. Do **not** reuse
`#respond()` (it sets the `access_token` cookie and returns a serialized user, neither of
which applies here).

## Files to Change

- `backend/src/auth/auth.service.ts` — add `#isActiveToken` and `status()`.
- `backend/src/auth/tests/auth.service.spec.ts` — cover `status()`: active token → `true`;
  unknown/missing token → `false`; expired token → `false`; **revoked token → `false`,
  and assert the repository's `update` (i.e. `#revokeTokenFamily`) is NOT called** — this
  is the one case that actually distinguishes the new method from
  `#findActiveRefreshToken` and must be explicitly tested.
- `backend/src/auth/auth.controller.ts` — add the `status.json` route.
- `backend/src/auth/tests/auth.controller.spec.ts` — cover: response shape
  `{ loggedIn: boolean }` for both `true`/`false` cases, `X-Skip-Cache` header set, no
  `access_token` cookie set, route reachable without an access-token cookie (`@Public()`).

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- The security specialist's review (during discuss-issue) flagged that a passive status
  endpoint lets someone holding an already-stolen refresh token silently confirm it's
  still valid, with no rate-limiting anywhere in this backend today. Accepted as a
  documented trade-off for this issue — no throttling added here.
