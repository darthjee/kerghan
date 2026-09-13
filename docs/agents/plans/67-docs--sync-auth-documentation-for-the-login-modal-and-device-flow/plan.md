# Plan: Docs: sync auth documentation for the login modal and device flow

Issue: [67-docs--sync-auth-documentation-for-the-login-modal-and-device-flow.md](../issues/67-docs--sync-auth-documentation-for-the-login-modal-and-device-flow.md)

## Overview

Documentation-only sync: the login modal and device-authorization flow (issue #58's sub-issues
2–8) are already fully merged in code, but several docs still describe the pre-#58 (or even
pre-NestJS) state. This plan corrects the stale "tooling-only skeleton" / "login is just a GitHub
handle" copy, then documents the new flow (entity, five endpoints, status machine, poll-token
contract, enumeration safety, hardening limits) and its five new environment variables.

## Context

- All of #58's sub-issues 2–8 are merged (PRs #79, #80, #83, #84, #85) — the shipped code is the
  ground truth this plan documents, not a moving target.
- Real login: username/password, JWT `access_token` cookie (`KERGHAN_ACCESS_TOKEN_TTL_MS`),
  rotating refresh token — see `backend/src/auth/`.
- Device-authorization flow: `AuthorizationRequest` entity (table `auth_authorization_requests`,
  `backend/src/auth/entities/authorization-request.entity.ts`), five endpoints on
  `AuthorizationRequestController` (`backend/src/auth/authorization-request.controller.ts`), and
  rate-limiting/hardening in `AuthorizationRequestAbuseGuardService`
  (`backend/src/auth/authorization-request-abuse-guard.service.ts`).
- Real frontend: `LoginModal` + controller/helpers/hooks
  (`frontend/assets/js/components/common/loginModal/`), `AuthorizationRequests` "My account" page
  and poller (`frontend/assets/js/components/resources/accounts/pages/`,
  `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js`), hash-based `Router`
  (`frontend/assets/js/utils/routing/`), and a full `client/` layer (`AccountsClient`,
  `ApiClient`, `AuthSession`, `AuthEvents`, `LoginModalEvents`, `AdminClient`).
- This is pure documentation/config-doc work spanning root files (`AGENTS.md`, `README.md`) and
  `docs/agents/**`/`.claude/agents/frontend.md` — none of it touches `backend/` or `frontend/`
  source, so no specialist agent (backend/frontend/etc.) owns any of it; the architect handles the
  whole plan directly.

## Steps

- [01 — Correct stale skeleton / GitHub-handle copy](plan/01-correct-stale-copy.md)
- [02 — Document the device-authorization flow in modules/auth.md](plan/02-document-modules-auth.md)
- [03 — Extend backend/routes/auth.md with the five new endpoints](plan/03-extend-routes-auth.md)
- [04 — Add an Owned tables section to architecture/backend.md](plan/04-owned-tables-backend.md)
- [05 — Catalog the five new env vars](plan/05-catalog-env-vars.md)

## Notes

- Do not touch any non-`.md` file — this issue is documentation-only.
- Step 1 must land before/alongside Step 2 conceptually (both touch `docs/agents/flow.md`'s
  step 1 and "Open questions" section), but there's no file overlap forcing strict ordering
  beyond avoiding two uncommitted edits to the same file at once — do them in the listed order.
- No CI job lints Markdown in this repo today (`.circleci/config.yml` only lints/tests
  backend/frontend/proxy-extension code), so no `## CI Checks` section applies here.
