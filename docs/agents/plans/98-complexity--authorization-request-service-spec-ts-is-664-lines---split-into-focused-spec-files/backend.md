# Backend Plan: Complexity: authorization-request.service.spec.ts is 664 lines — split into focused spec files

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared test scaffolding into a helper](backend/01-extract-shared-test-scaffolding.md)
- [02 — Split off the `create` spec file](backend/02-split-create-spec.md)
- [03 — Split off the `poll` spec file](backend/03-split-poll-spec.md)
- [04 — Split off the `listOpenForUser` spec file](backend/04-split-listopenforuser-spec.md)
- [05 — Split off the `authorize` spec file](backend/05-split-authorize-spec.md)
- [06 — Split off the `deny` spec file and remove the original](backend/06-split-deny-spec-and-cleanup.md)

## CI Checks
- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes
- The 5 top-level `describe` blocks in the current file have clean, non-overlapping line ranges (`create` 86–330, `poll` 331–486, `listOpenForUser` 487–539, `authorize` 540–723, `deny` 724–819), so each can be lifted into its own file with no logic changes — this is a pure move/rename refactor.
- `bcryptjs` is used directly inside the `authorize` describe block (`bcrypt.hashSync(...)`, line 541) in addition to the shared helper — its spec file needs its own `import bcrypt from 'bcryptjs'`.
- Keep each new file's `describe('AuthorizationRequestService', () => { describe('<method>', () => { ... }) })` nesting exactly as it is today (outer `describe('AuthorizationRequestService', ...)` wrapping the single per-method `describe`), so Jest test names in CI/coverage output are unchanged.
- Run `npm run coverage` after the split (Step 6) and diff coverage before/after to confirm no scenario was dropped in the move.
