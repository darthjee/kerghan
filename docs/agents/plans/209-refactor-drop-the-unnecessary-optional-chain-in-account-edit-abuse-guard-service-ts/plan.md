# Plan: Refactor: Drop the unnecessary optional chain in account-edit-abuse-guard.service.ts

Issue: [209-refactor-drop-the-unnecessary-optional-chain-in-account-edit-abuse-guard-service-ts.md](../../issues/209-refactor-drop-the-unnecessary-optional-chain-in-account-edit-abuse-guard-service-ts.md)

## Overview
Rewrite `AccountEditAbuseGuardService#isDuplicateUserIdError` so it narrows `error` with `instanceof QueryFailedError` and reads `driverError.code` through `unknown` narrowing instead of a cast plus `?.`, removing the High `no-unnecessary-condition` finding without changing behavior, and extend the guard spec to cover every branch.

See [backend.md](backend.md) for the full plan.
