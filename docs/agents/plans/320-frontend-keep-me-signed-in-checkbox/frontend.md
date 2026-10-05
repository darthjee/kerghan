# Frontend Plan: Frontend: "Keep me signed in" checkbox

Main plan: [plan.md](plan.md)

## Overview

This plan wires the backend's `keepSignedIn` option (#319, merged) into the login modal and the
approver page. No backend, proxy or cache changes are needed: there are no new endpoints, and the
existing ones only gain a request field and a response field.

## Context

- `POST /auth/login.json` accepts `{ username, password, keepSignedIn? }`, and
  `POST /auth/authorization-requests.json` accepts `{ username, keepSignedIn? }`. `keepSignedIn` is a
  strict optional boolean: a non-boolean value is rejected with `400`, so always send a real
  `true`/`false`.
- Each open request in the approver's list (`OpenAuthorizationRequest`) now carries
  `keepSignedIn: boolean`.
- The modal resets every field on mode switch (`LoginModalController#switchMode` →
  `INITIAL_FIELDS`), so adding `keepSignedIn: false` there gives "unchecked by default, never
  remembered, resets on tab switch" without extra logic.

## Steps

- [01 — Send keepSignedIn from AccountsClient](frontend/01-accounts-client.md)
- [02 — Hold and submit the flag in the login modal](frontend/02-modal-state-and-controller.md)
- [03 — Render the checkbox on Password and device tabs](frontend/03-render-checkbox.md)
- [04 — Approver "Keep signed in" badge](frontend/04-approver-badge.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- The checkbox is a plain label "Keep me signed in": no helper text and no duration, because the
  TTL can be changed through env vars.
- `AuthSession` / `localStorage` handling is unchanged.
- Register, Recover and Set-new-password never show or send the flag.
