# Issue: Refactor: Replace req.user! non-null assertions with a typed authenticated-user accessor

## Description
Controllers reach for the JWT payload with `req.user!`, which typescript-eslint flags as a forbidden non-null assertion.

## Problem
`@typescript-eslint/no-non-null-assertion` (High) at:

- `backend/src/auth/auth.controller.ts:57`
- `backend/src/auth/authorization-request.controller.ts:96`, `:120`, `:136`

`req.user` is declared optional in `backend/src/types/express.d.ts`; the guard (`backend/src/core/jwt.guard.ts`) guarantees it is set on these routes, but the type system cannot see that, so the code asserts it. There is no shared accessor today.

## Expected Behavior
The same routes behave identically, and no `!` assertion remains in these controllers.

## Solution
Add a `@CurrentUser()` parameter decorator (via `createParamDecorator`, in `backend/src/core/` next to `jwt.guard.ts`) that returns the `AccessTokenPayload` and throws `UnauthorizedException` when it is missing, then use it in the four handlers in place of `@Req() req` + `req.user!`. This keeps controllers thin (see `CLAUDE.md` Boundaries). Add a unit spec for the decorator covering present and missing user.

## Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

## Benefits
Removes four High findings, turns a silent assumption into an explicit 401, and gives future controllers the right way to read the caller.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
