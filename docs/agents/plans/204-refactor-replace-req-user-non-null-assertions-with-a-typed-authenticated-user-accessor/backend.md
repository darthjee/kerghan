# Backend Plan: Refactor: Replace req.user! non-null assertions with a typed authenticated-user accessor

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add the CurrentUser param decorator](backend/01-add-current-user-decorator.md)
- [02 — Replace req.user! with @CurrentUser() in the four handlers](backend/02-replace-non-null-assertions.md)
- [03 — Add a unit spec for the decorator](backend/03-add-decorator-spec.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- Scope is exactly the four flagged call sites (`auth.controller.ts:57`, `authorization-request.controller.ts:96/120/136`) — no other file in the repo uses `req.user!` (verified by grep during discussion), so no fifth usage should turn up during implementation.
- Route behavior must stay byte-identical: same `401 Unauthorized` outcome when the guard hasn't set `request.user` (today's implicit crash-on-undefined-access risk becomes an explicit, intentional `UnauthorizedException`, but the guard already prevents this from being reachable on these routes in practice).
- `backend/src/types/express.d.ts`'s `user?: AccessTokenPayload` declaration does not need to change — the decorator is what narrows the type, not the ambient declaration.
