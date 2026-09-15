# Plan: Complexity: authorization-request.service.spec.ts is 664 lines — split into focused spec files

Issue: [98-complexity--authorization-request-service-spec-ts-is-664-lines---split-into-focused-spec-files.md](../issues/98-complexity--authorization-request-service-spec-ts-is-664-lines---split-into-focused-spec-files.md)

## Overview
Split `backend/src/auth/tests/authorization-request.service.spec.ts` (819 lines, currently a single file covering all of `AuthorizationRequestService`) into one spec file per public method, backed by a shared test-support helper. Backend-only, pure test reorganization — no behavior or coverage change.

See [backend.md](backend.md) for the full plan.
