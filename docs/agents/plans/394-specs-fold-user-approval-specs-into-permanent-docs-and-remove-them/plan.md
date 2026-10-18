# Plan: Specs: fold user approval specs into permanent docs and remove them

Issue: [394-specs-fold-user-approval-specs-into-permanent-docs-and-remove-them.md](../../issues/394-specs-fold-user-approval-specs-into-permanent-docs-and-remove-them.md)

## Overview

Docs-only change, owned by the architect. Move the lasting content of
`docs/agents/specs/user-approval/` (`README.md`, `model.md`, `security.md`, `api.md`, `ui.md`)
into the permanent docs, rewrite the auth caveats the session-lookup gate made false, then delete
the spec folder and move its entry to "Completed specs" in `docs/agents/specs.md`. Precedent: #373
(default user).

## Context

Every implementation sub-issue of Epic #389 is merged (#390 specs, #391 session-lookup gate, #392
user-side flow, #393 admin review). The only content already in the permanent docs is the
`KERGHAN_USER_APPROVAL_REQUIRED` row in `environment-variables.md` (sections 1 and 5).

Placement decided in the issue:

- The **session-lookup gate** (`sid` claim, `JwtGuard` lookup, `request.user` from the DB,
  `sid`-less tokens rejected, immediate effects) is general auth. It goes into
  `modules/auth.md`, "JWT/refresh-token flow".
- The **approval-specific rules** go into a new `modules/auth/user-approval.md`, laid out like
  `modules/auth/default-user.md`. This includes a "Frontend" section.
- `architecture/frontend.md` gets only a short note that links to the new doc.

Writing rules (same as #373):

- Keep short "Why" notes next to each rule.
- **The code is the source of truth.** Where the merged code differs from the spec, document the
  code. Check names against `backend/src/core/error-codes.ts`, `backend/src/core/jwt.guard.ts`,
  `backend/src/auth/*.service.ts`, `backend/src/auth/entities/*` and
  `backend/src/auth/user-approval.config.ts`.
- Replace the "Required tests" lists with a short "Testing" note.
- Do not carry over the sub-issue map, the delivery order, or the "#394 adds …" notes.

## Steps

- [01 — Session-lookup gate and stale caveats in the auth module](plan/01-auth-module-gate.md)
- [02 — New user-approval module doc](plan/02-user-approval-module-doc.md)
- [03 — Auth route contracts](plan/03-auth-routes.md)
- [04 — Frontend, default-user, product and env docs](plan/04-cross-references.md)
- [05 — Delete the spec folder and update the specs hub](plan/05-remove-specs.md)

## Notes

- No code changes. No CI job lints `docs/`, so the check is a manual review plus the grep in
  step 05.
- Close Epic #389 once this issue merges. It is the last open sub-issue.
- `docs/agents/issues/` and `docs/agents/plans/` keep their historical links to
  `specs/user-approval/`. Leave them as they are.
