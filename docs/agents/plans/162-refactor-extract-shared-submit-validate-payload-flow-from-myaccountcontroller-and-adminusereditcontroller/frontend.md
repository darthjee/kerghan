# Frontend Plan: Refactor: extract shared submit/validate/payload flow from MyAccountController and AdminUserEditController

Main plan: [plan.md](plan.md)

## Overview
Everything lives under `frontend/`, so `frontend` is the single owner. Decisions already settled in the issue discussion:

- Shared **base class** (not composition); subclasses override hook methods. JS `#private` methods cannot be called from a subclass, so the hooks are regular (non-`#`) methods.
- The shared `pickDefined` helper is for the **client layer only** (`!== undefined`); the controllers' truthiness filtering (blank string = not filled in) stays in the base class.
- Out of scope, do not touch: #167 (shared validators — `validate` keeps its current bodies, incl. the duplicated `EMAIL_PATTERN`/`MIN_PASSWORD_LENGTH`, just moved into the base), #168 (`redirectHome`/`redirectIfForbidden` — the admin 403 redirect stays as a subclass hook), #172 (React hook for the `.jsx` pages), #163 (spec dedupe).

## Context
Both controllers share an identical constructor (`setFields, setFieldErrors, setSubmitError, setSuccess, client`), `handleSubmit` flow, `validate` email/new-password rules, `#buildPayload` truthiness filter, `#hasUpdate`, and `#applySuccess`. Differences: My Account also validates/sends `currentPassword`, calls `client.updateAccount(payload)`, receives `{username,email}` and clears `currentPassword` on success; Admin Edit takes a `userId`, calls `client.editUser(userId, payload)`, receives `{user}` and redirects home on `403`. The public entry points (`MyAccountController#handleSubmit(fields)`, `AdminUserEditController#handleSubmit(userId, fields)`, `validate(fields)`) and constructor signatures must stay exactly as they are — the `.jsx` pages and the existing specs depend on them.

## Steps

- [01 — Add pickDefined helper and use it in the clients](frontend/01-add-pickdefined-helper.md)
- [02 — Add AccountEditFormController base class](frontend/02-add-account-edit-form-controller.md)
- [03 — Migrate both controllers onto the base class](frontend/03-migrate-controllers.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_frontend yarn lint` (i.e. `npm run lint`; CI job: `frontend-checks`) — ESLint enforces max complexity 10, max 300 lines/file and JSDoc on public API
- `frontend`: `docker-compose run --rm kerghan_frontend yarn coverage` (i.e. `npm run coverage`; CI job: `jasmine`)

Confirm the exact docker-compose service name from `docker-compose.yml`; never run `yarn`/`npm` directly on the host (CLAUDE.md boundary).

## Notes
- The existing `MyAccountControllerSpec` and `AdminUserEditControllerSpec` must keep passing **unchanged** — that is the behavior-preservation check. Only add new specs for the new files.
- Watch ESLint's max-complexity 10 on the base `handleSubmit`-equivalent; keep it split into small methods like today's code.
- Field-clearing on success differs (`currentPassword` only for My Account) — expose it as a hook (e.g. `clearedFields()`), not a `currentPassword in payload` conditional in the base.
