# Frontend Plan: Refactor: extract shared redirectHome/redirectIfForbidden helpers from frontend controllers

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add redirect helpers and specs](frontend/01-add-redirect-helpers.md)
- [02 — Use helpers in the five controllers](frontend/02-use-helpers-in-controllers.md)
- [03 — Use helper in the two components and fix doc comments](frontend/03-use-helper-in-components.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`, runs `npm run coverage`)

## Notes
- The existing controller/component specs install a fake `window` via `specs/support/fakeWindow.js` (`installFakeWindow` / `uninstallFakeWindow`). The helper must read the global `window` at call time (not capture it at import), so those specs keep passing **unchanged** — that is the proof of "no behavior change". Do not edit them.
- `redirectHome()` must stay a no-op when `window` is undefined (SSR/spec-safe) and set `window.location.hash = '/'` otherwise.
- Follow the file's JSDoc conventions (`@param`, `@returns`, `@description` on public functions); JSDoc is not required in specs.
- Never run `yarn`/`npm` on the host — always through `docker-compose`.
