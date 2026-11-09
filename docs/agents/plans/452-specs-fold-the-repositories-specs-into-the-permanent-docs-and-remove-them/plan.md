# Plan: Specs: fold the repositories specs into the permanent docs and remove them

Issue: [452-specs-fold-the-repositories-specs-into-the-permanent-docs-and-remove-them.md](../../issues/452-specs-fold-the-repositories-specs-into-the-permanent-docs-and-remove-them.md)

## Overview

This is a docs-only fold of `docs/agents/specs/repos/` into the permanent docs. It is done in one PR with staged commits, after a preflight that spot-checks the specs against the merged code. The work then deletes the spec folder and moves the feature to "Completed specs". It is architect work (cross-cutting docs and root files), so no specialist split is needed. Source comments that cite the specs are repointed as comment-only edits.

## Context

- The issue is **blocked** until every implementation sub-issue of Epic #444 is merged.
- **Source of truth for what to fold:** the "Product changes folded by #452" checklist in `docs/agents/specs/repos/README.md`. Each item ends **done** or **moot** (with a reason).
- **Layout:** `modules/repositories.md` (hub: overview, data model, security, frontend, testing, index), `modules/repositories/sync.md`, `modules/repositories/edge-cases.md`, and `backend/routes/repositories.md` (from `api.md`).
- **Drift:** spot-check the hard contracts. The docs describe what was built; a mismatch that looks wrong in the code gets a new issue linked to #444. The PR lists every mismatch.
- **Root files:** reword `CLAUDE.md` / `AGENTS.md` (the backend lists repos; issue data is still fetched by the browser, unauthenticated) and add the "credentials stay in the backend" boundary. They still link only to `specs.md`.
- **Precedents for shape:** `modules/auth/user-approval.md`, `modules/integrations.md` (Frontend and Testing sections, "Not built yet" notes), and the "Completed specs" rows in `docs/agents/specs.md`.

## Steps

- [01 — Preflight: blocking check, open markers, contract spot-check](plan/01-preflight.md)
- [02 — New Repositories docs](plan/02-repositories-docs.md)
- [03 — Integrations and Auth docs](plan/03-integrations-auth-docs.md)
- [04 — Product, architecture, env, root files](plan/04-product-cross-cutting.md)
- [05 — Delete the specs, close the lifecycle, link sweep](plan/05-delete-and-sweep.md)
- [06 — Final review and PR description](plan/06-final-review.md)

## CI Checks

- Docs-only. No CI job validates markdown links. The backend/frontend lint and test jobs only need to stay green after the comment-only edits. Run them through docker-compose if any source comment was touched, e.g. `docker-compose run --rm kerghan_backend yarn lint` and the frontend equivalent.

## Notes

- Verification is manual by the maintainer (per the issue). The grep/anchor checks in step 05 are aids, not committed tooling.
- Conditional items (`Clock` / `SyncLauncher` promotion, the ESLint mention in `contributing.md`) are decided by usage outside `backend/src/repositories/` at fold time.
- If no user-deletion path exists, `modules/auth.md` gets a "Not built yet" note for the `user.deleted` emitter.
- A descoped implementation sub-issue is left out of the docs and recorded in `product.md` "What's still open".
- Historical `docs/agents/issues/` and `docs/agents/plans/` files are not rewritten.
