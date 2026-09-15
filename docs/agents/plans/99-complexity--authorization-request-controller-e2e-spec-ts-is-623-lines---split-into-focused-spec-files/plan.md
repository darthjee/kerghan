# Plan: Complexity: authorization-request.controller.e2e-spec.ts is 623 lines — split into focused spec files

Issue: [99-complexity--authorization-request-controller-e2e-spec-ts-is-623-lines---split-into-focused-spec-files.md](../../issues/99-complexity--authorization-request-controller-e2e-spec-ts-is-623-lines---split-into-focused-spec-files.md)

## Overview

Split `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` (773 lines) into a shared test-support file plus four scenario-focused e2e spec files, mirroring the pattern already established by #98's split of the sibling service spec.

See [backend.md](backend.md) for the full plan.
