# Plan: Specs: user approval feature definition

Issue: [390-specs-user-approval-feature-definition.md](../../issues/390-specs-user-approval-feature-definition.md)

## Overview

Write the temporary feature specs `docs/agents/specs/user-approval/` for the optional admin
approval of new users (Epic #389), and register them under "Active specs" in
`docs/agents/specs.md`. Docs only: every decision is already settled in #389 and #390; this plan
places each one in the spec file that owns it, so #391–#394 build against the specs without
re-deciding anything.

## Context

- Lifecycle and conventions: `docs/agents/specs.md` (one `README.md` per feature, one file per
  concern, a "Required tests" section at the end of each file, decisions rather than code; name
  existing code only to point at a convention).
- Sub-issues reading the specs: #391 (session-lookup gate), #392 (user-side flow, BE + FE),
  #393 (admin review, BE + FE), #394 (fold into permanent docs and remove).
- Existing contracts the specs extend: `docs/agents/backend/routes/auth.md` (`status.json`,
  session cookies, device authorization), `docs/agents/modules/auth.md`,
  `docs/agents/modules/auth/default-user.md` (managed fields, automatic login,
  `409 DEFAULT_USER_MANAGED`), `docs/agents/environment-variables.md` (flag conventions),
  `backend/src/core/error-codes.ts` and `http-exception.filter.ts` (error body shape),
  `backend/src/auth/entities/refresh-token.entity.ts` (`RevokedReason`, indexed
  `session_uuid`), `backend/src/core/jwt.guard.ts`, `backend/src/auth/admin.controller.ts`,
  `frontend/assets/js/client/ApiClient.js` (refresh-and-retry on `401`).

## Steps

- [01 — README and Active specs entry](plan/01-readme-and-active-specs.md)
- [02 — model.md](plan/02-model.md)
- [03 — security.md](plan/03-security.md)
- [04 — api.md](plan/04-api.md)
- [05 — ui.md](plan/05-ui.md)

## Notes

- No code changes and no permanent-doc changes: `environment-variables.md` gets its row in #392,
  and the permanent docs are updated in #394.
- Consult the product-owner, security and data-access agents on the written specs (product
  concepts, the gate and non-disclosure rules, response fields exposed to admins).
- Keep the specs consistent with the bodies of #391–#394; if a spec has to refine something
  those issues state, the spec wins and the difference is called out in the PR description.
