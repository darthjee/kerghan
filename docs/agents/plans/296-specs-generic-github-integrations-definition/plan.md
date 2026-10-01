# Plan: Specs: generic GitHub integrations definition

Issue: [296-specs-generic-github-integrations-definition.md](../../issues/296-specs-generic-github-integrations-definition.md)

## Overview

Documentation-only issue. Write the generic, type-agnostic definition of the GitHub
integrations feature (#295) under `docs/agents/specs/integrations/` (`README.md`, `model.md`,
`api.md`, `security.md`, `ui.md`, `type-contract.md`), create the permanent specs hub
`docs/agents/specs.md`, link it from the doc indexes, add an "in progress" pointer to
`product.md`, and reword the "no GitHub credential storage" boundary in `CLAUDE.md` (and its
mirror in `AGENTS.md`) so storage is allowed only for integrations as defined by the specs.

No code, migration, config or env-var change is made here — every implementation decision is
only *encoded* in the specs, for #297–#303 to build against.

## Context

- #295 is the parent feature: users register GitHub credentials ("integrations") that the
  backend — never the browser — will use to talk to GitHub. `provider` is `github`; `type` is
  `pat`, `oauth_app` or `github_app`.
- The issue body's **Solution** section already records every decision agreed in refinement
  (storage model A, status lifecycle, API routes table, admin visibility, edge cases, encryption
  key strength, key rotation deferral to #305, secrets-never-logged rules, rate limiting, testing
  strategy, backward compatibility). The specs must encode those decisions faithfully; the
  remaining "the spec picks…" choices are resolved in the step files below, aligned with
  existing code conventions.
- Existing conventions the specs must reference (verified in the codebase):
  - Error format and codes: `backend/src/core/error-codes.ts`, `http-exception.filter.ts`
    (#283). Category codes exist for 400/401/403/404/409/423/429/500; specific codes are attached
    at the throw site (e.g. `USERNAME_TAKEN`).
  - Lockouts: `backend/src/core/lockout-state.ts`, `LockedException` (423 `LOCKED`),
    `backend/src/auth/account-edit-abuse-guard.service.ts`, env vars
    `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` / `KERGHAN_ACCOUNT_EDIT_LOCK_MS` (milliseconds).
  - Numeric config: `backend/src/core/numeric-config.ts` (`getNumberConfig`).
  - Caching: `docs/agents/architecture/caching.md`, `@CachePolicy` cache classes, `X-Skip-Cache`.
  - User-scoped POST reads: `POST /auth/authorization-requests/mine.json`
    (`docs/agents/backend/routes/auth.md`).
  - Secret key handling: `backend/src/core/secret-keys.ts`; logging:
    `backend/src/core/logger.service.ts`.
  - "My account" dropdown: `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`.
- Nothing under `backend/`, `frontend/`, `proxy/`, `navi/` or infra files changes, so no
  specialist implementation agent has work; everything is in the architect's scope
  (`docs/agents/`, `CLAUDE.md`, `AGENTS.md`).

## Steps

- [01 — Create the specs hub and link it](plan/01-create-specs-hub.md)
- [02 — Write `integrations/README.md`](plan/02-write-readme.md)
- [03 — Write `integrations/model.md`](plan/03-write-model.md)
- [04 — Write `integrations/api.md`](plan/04-write-api.md)
- [05 — Write `integrations/security.md`](plan/05-write-security.md)
- [06 — Write `integrations/ui.md`](plan/06-write-ui.md)
- [07 — Write `integrations/type-contract.md`](plan/07-write-type-contract.md)
- [08 — Product pointer and agent-boundary rewording](plan/08-product-pointer-and-boundary.md)
- [09 — Lint and agent review](plan/09-lint-and-review.md)

## CI Checks

- CircleCI has no markdown job; markdown is linted by Codacy's `markdownlint` engine on the PR.
  Locally, lint through Docker (never on the host), e.g.
  `docker run --rm -v "$PWD":/work -w /work davidanson/markdownlint-cli2 "docs/agents/specs.md" "docs/agents/specs/**/*.md" "docs/agents/product.md" "docs/agents/index.md" "docs/agents/summary.md" CLAUDE.md AGENTS.md`.
  Backend/frontend CI jobs are unaffected (no code change).

## Notes

- **Spec decisions this plan fixes** (the issue left them to "the spec"); keep them consistent
  across files:
  - Failure cool-off on create/replace: **423 `LOCKED`** with specific code
    `INTEGRATION_CREDENTIAL_LOCKED`, matching the existing account-edit lockout
    (`LockedException`).
  - Test cooldown: **429** with `Retry-After` and code `INTEGRATION_TEST_COOLDOWN`.
  - Per-user cap: **409** with code `INTEGRATIONS_LIMIT_REACHED` (conflict with current state;
    not a validation error of the payload).
  - Duplicate label: **409** `INTEGRATION_LABEL_TAKEN`.
  - Credential rejected by GitHub / invalid: **422** `INTEGRATION_CREDENTIAL_INVALID`;
    insufficient scopes/permissions: **422** `INTEGRATION_INSUFFICIENT_PERMISSIONS`.
    (422 is not yet in `CATEGORY_CODES`; the spec must say #300 adds a `422 →
    UNPROCESSABLE_ENTITY` category mapping, or else use 400 — prefer adding 422, and state it.)
  - Payload validation failures: **400** `VALIDATION_FAILED` (existing).
  - GitHub unreachable/5xx/rate-limited: **502** `GITHUB_UNAVAILABLE` (503 when GitHub reports
    rate limiting, code `GITHUB_RATE_LIMITED`).
  - Env vars: `KERGHAN_INTEGRATIONS_KEY`, `KERGHAN_INTEGRATIONS_MAX_PER_USER` (default 20),
    `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` (default 5),
    `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS` (default 900000 = 15 min, milliseconds like the
    existing `_LOCK_MS` vars), `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS` (default 30000).
  - Key id: first 8 hex chars of SHA-256 over the raw 32 key bytes.
  - "Expiring soon" UI window: 7 days.
  - Lockout table name: `integrations_credential_lockouts` (mirrors
    `auth_account_edit_lockouts`; check the actual table name in
    `backend/src/database/migrations/20260914120010-auth-create-account-edit-lockouts.ts` and
    mirror its shape).
- The specs are **temporary** (deleted by #304's cleanup); the hub `docs/agents/specs.md` is
  permanent. Do not edit `flow.md`, `modules/`, `environment-variables.md` or `.env.dev.sample`
  here — those belong to #300/#304.
- `Retry-After` is not emitted anywhere in the backend today; `api.md` should state #300
  introduces it.
- Per the issue's verification, the product-owner, security and data-access agents must have no
  open objection; step 09 covers that review loop.
