# Frontend Plan: Repositories: Frontend — GitHub handle field on the Account page

Main plan: [plan.md](plan.md)

## Overview
A new, self-contained **GitHub handle** section on `#/account/my-account`, apart from the username / email / password form. It has its own state, controller and render helper, so the existing `useAccountEditForm` / `AccountEditFormController` flow (shared with `AdminUserEdit`) is left untouched.

## Context
- Spec: `docs/agents/specs/repos/ui.md#github-handle-field` (behavior and texts), `model.md#github-handle` (normalisation and the regex `^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$`), `model.md#setting-it-patch-authaccountjson` and `#reading-it-post-authaccountminejson` (contract), `testing.md#frontend` (spec layers).
- The backend is done (#460): `POST /auth/account/mine.json` returns `{ username, email, githubHandle }`. `PATCH /auth/account.json` with only `{ githubHandle }` needs no `currentPassword` and returns `{ username, email, githubHandle }`.
- Today `AccountsClient#updateAccount` always sends `currentPassword`, and there is no read call. `MyAccount.jsx` renders only `MyAccountHelper` → `AccountEditFormHelper`.
- Existing patterns to follow: load-on-mount with `buildLoadEffect` + `useMemo` controller (`Sessions.jsx`), state-setter controllers (`SessionsController`, `MyAccountController`), `FormFieldsHelper.renderField` / `renderSubmitError` / `renderSuccess` for markup, and `elementTree` / `renderedOutput` / `fetchSequence` / `flushMicrotasks` in `specs/support/`.

## Steps

- [01 — AccountsClient: read and handle-only update](frontend/01-accounts-client.md)
- [02 — GitHub handle controller](frontend/02-github-handle-controller.md)
- [03 — Section rendering and page wiring](frontend/03-section-render-and-wiring.md)
- [04 — Spec README row](frontend/04-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`, which runs `yarn coverage`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- No backend, navi or proxy change. The main form keeps its texts and behavior: it is still not prefilled, which the spec states explicitly.
- `frontend/specs/` must never contain `api.github.com`. The help text mentions the Repositories page without linking to it: the page arrives with #466.
- If a spec text turns out to be underspecified, update `docs/agents/specs/repos/ui.md` and say so in the PR description (shared Epic rule).
