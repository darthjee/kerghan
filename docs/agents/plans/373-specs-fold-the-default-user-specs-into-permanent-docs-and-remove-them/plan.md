# Plan: Specs: fold the default user specs into permanent docs and remove them

Issue: [373-specs-fold-the-default-user-specs-into-permanent-docs-and-remove-them.md](../../issues/373-specs-fold-the-default-user-specs-into-permanent-docs-and-remove-them.md)

## Overview

Docs-only change, owned by the architect (no specialist agent owns `docs/agents/`). Move the
lasting content of `docs/agents/specs/default-user/` into the permanent docs, then delete the
folder and move the hub entry to "Completed specs". This closes Epic #366.

## Context

- The standalone side is mostly folded already (#371/#372): `standalone.md` and the section 5
  "Default user" row of `environment-variables.md`.
- The backend side is not folded: section 1 of `environment-variables.md`, `modules/auth.md` and
  `backend/routes/auth.md` do not mention the default user.
- The only link into the spec folder from permanent docs is `standalone.md` line ~310 (and the
  hub entry in `specs.md`).
- Decisions from the discussion:
  - The backend content goes into a new `modules/auth/default-user.md`, laid out like
    `modules/integrations/`.
  - Keep short "Why" notes next to each rule.
  - Replace the "Required tests" lists with a "Testing" note that names the test files.
  - Record the open client-IP verification as caveats in `standalone.md` that link to #384.
  - Do not carry over the spec bookkeeping (the sub-issue map, the "variables live only here"
    note, the lifecycle section).
- Code to name in the docs: `backend/src/auth/default-user.config.ts`,
  `default-user.service.ts` and `default-user-allowlist.ts`. Tests:
  `backend/src/auth/tests/default-user.config.spec.ts`, `default-user.service.spec.ts`,
  `auth.controller.default-user.e2e-spec.ts`, `admin.controller.default-user.e2e-spec.ts`, and
  `standalone/test/{auto_login,bind,update_env,upgrade}.bats`.

## Steps

- [01 — Backend variables in environment-variables.md](plan/01-environment-variables.md)
- [02 — New modules/auth/default-user.md](plan/02-module-default-user.md)
- [03 — Route contracts in backend/routes/auth.md](plan/03-routes-auth.md)
- [04 — Complete standalone.md](plan/04-standalone.md)
- [05 — Product entry](plan/05-product.md)
- [06 — Remove the spec folder and update the hub](plan/06-remove-spec.md)

## Notes

- Before writing each target, read every spec file in full (`README.md`, `configuration.md`,
  `boot-sync.md`, `edit-blocking.md`, `automatic-login.md`, `security.md`, `standalone.md`). When
  the spec and the code disagree, the code (merged in #368–#372) wins. Note any such difference in
  the PR description.
- Do not delete the spec folder (step 06) until steps 01–05 cover each spec section. Use a
  section-by-section checklist (the spec headings) in the PR description to show nothing was
  dropped.
- No CI job lints `docs/`. Check by hand that every relative link resolves.
- No code changes.
