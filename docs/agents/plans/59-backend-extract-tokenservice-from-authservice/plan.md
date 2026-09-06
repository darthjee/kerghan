# Plan: Backend: extract TokenService from AuthService

Issue: [59-backend-extract-tokenservice-from-authservice.md](../issues/59-backend-extract-tokenservice-from-authservice.md)

## Overview

Behaviour-preserving refactor: move session minting (`#issueTokens` / `#touchSession` /
`#hashToken`) out of `backend/src/auth/auth.service.ts` into a new injectable `TokenService` in
the Auth module, so the upcoming `AuthorizationRequestService` (#58 sub-issue 2) can reuse it and
`auth.service.ts` drops back under the 300-line ESLint `max-lines` limit.

See [backend.md](backend.md) for the full plan.
