# Plan: Refactor: extract shared lockout-state computation from abuse-guard services

Issue: [135-refactor-extract-shared-lockout-state-computation-from-abuse-guard-services.md](../issues/135-refactor-extract-shared-lockout-state-computation-from-abuse-guard-services.md)

## Overview

Extract the duplicated "attempts + lockedUntil" cool-off arithmetic out of
`AccountEditAbuseGuardService` and `AuthorizationRequestAbuseGuardService` into a single pure
helper, so the two services can't silently diverge and the calculation gets its own direct unit
tests.

See [backend.md](backend.md) for the full plan.
