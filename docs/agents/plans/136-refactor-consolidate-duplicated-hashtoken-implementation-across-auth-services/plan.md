# Plan: Refactor: consolidate duplicated hashToken implementation across auth services

Issue: [136-refactor-consolidate-duplicated-hashtoken-implementation-across-auth-services.md](../issues/136-refactor-consolidate-duplicated-hashtoken-implementation-across-auth-services.md)

## Overview
Extract the `createHash('sha256').update(token).digest('hex')` one-liner, currently duplicated in `TokenService`, `PasswordResetService`, and `AuthorizationRequestService`, into a single shared `backend/src/core/token-hash.ts` utility.

See [backend.md](backend.md) for the full plan.
