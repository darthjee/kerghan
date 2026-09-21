# Plan: Refactor: dedupe authorization-request.service specs (authorize/create setup and repeated cases)

Issue: [174-refactor-dedupe-authorization-request-service-specs-authorize-create-setup-and-repeated-cases.md](../../issues/174-refactor-dedupe-authorization-request-service-specs-authorize-create-setup-and-repeated-cases.md)

## Overview
Test-only refactor under `backend/src/auth/tests/`: a shared `useAuthorizationRequestServiceContext()` hook replaces the per-file `let` + destructuring `beforeEach` in all five `authorization-request.service.*.spec.ts` files, a shared assertion helper removes the cross-spec clone with the abuse-guard spec, and the repeated cases in the `create`/`authorize` specs are parameterised or extracted. No production code changes.

See [backend.md](backend.md) for the full plan.
