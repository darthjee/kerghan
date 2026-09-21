# Frontend Plan: Refactor: extract shared account-edit form hook from MyAccount.jsx and AdminUserEdit.jsx

Main plan: [plan.md](plan.md)

## Overview
`MyAccount.jsx` and `AdminUserEdit.jsx` both keep `fields`/`fieldErrors`/`submitError`/`success` in `useState`, memoise a controller built from the four setters, and define the same `onChange` handler and an `onSubmit` handler (`event.preventDefault()` + `controller.handleSubmit(...)`). This plan moves that into one hook, `useAccountEditForm`, next to the shared `AccountEditFormController`/`AccountEditFormHelper` (#161/#162). Rendered output and behavior stay unchanged.

## Context
- Hook API: `useAccountEditForm({ initialFields, createController, submit })`.
  - `createController(setFields, setFieldErrors, setSubmitError, setSuccess)` builds the page's controller; the hook memoises the result once.
  - `submit(controller, fields)` is the per-page adapter that calls the controller's own `handleSubmit` (`MyAccountController.handleSubmit(fields)` vs `AdminUserEditController.handleSubmit(userId, fields)`); both controllers keep their current signatures.
  - Returns `{ state, handlers }` where `state = { ...fields, fieldErrors, submitError, success }` and `handlers = { onSubmit, onChange }`, ready for `Helper.render(state, handlers)`.
- Hooks live in `hooks/` folders next to their feature (`common/header/hooks`, `common/loginModal/hooks`), so the new one goes in `common/forms/hooks/`.
- Page specs render through `renderToStaticMarkup` and stub `Helper.render` to capture handlers; they must keep passing unchanged and act as the behavior guard.
- ESLint requires JSDoc (description, params, returns) on public functions in `assets/`; `react-hooks/exhaustive-deps` is a warning, so the intentional run-once memoisation needs a justified `eslint-disable-next-line` if the rule fires.

## Steps

- [01 — Add the useAccountEditForm hook](frontend/01-add-use-account-edit-form-hook.md)
- [02 — Add the hook spec](frontend/02-add-hook-spec.md)
- [03 — Migrate the pages and update docs](frontend/03-migrate-pages-and-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: frontend lint)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: frontend tests)

## Notes
- Do not change `MyAccountController`/`AdminUserEditController` or their specs; unifying their `handleSubmit` signatures is out of scope.
- Keep the SSR/spec-safe `currentHash()` route-param lookup in `AdminUserEdit.jsx` (it is guarded for `window` being undefined in Node specs).
- Run all tooling through `docker-compose`, never directly on the host (project boundary).
- #173 (captured-handlers spec helper) and #176 (controller spec setup) are separate issues; do not fold their spec changes in here.
