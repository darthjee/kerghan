# Plan: Complexity: auth.controller.e2e-spec.ts is 540 lines — split into focused spec files

Issue: [100-complexity--auth-controller-e2e-spec-ts-is-540-lines---split-into-focused-spec-files.md](../issues/100-complexity--auth-controller-e2e-spec-ts-is-540-lines---split-into-focused-spec-files.md)

## Overview

Pure test-file reorganization inside `backend/src/auth/tests/`: split the 673-line
`auth.controller.e2e-spec.ts` into a shared test-support file plus six concern-scoped
e2e spec files, mirroring the pattern already established for #98/#99. No behavior or
coverage change.

See [backend.md](backend.md) for the full plan.
