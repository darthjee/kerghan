# Plan: Refactor: dedupe repeated request/assert blocks in auth service/controller/admin specs

Issue: [175-refactor-dedupe-repeated-request-assert-blocks-in-auth-service-controller-admin-specs.md](../issues/175-refactor-dedupe-repeated-request-assert-blocks-in-auth-service-controller-admin-specs.md)

## Overview
Spec-only refactor inside `backend/`: fold repeated request/assert blocks and repeated setup into shared `beforeEach` blocks and small helpers, without removing any distinct behavior. No production code changes.

See [backend.md](backend.md) for the full plan.
