# Plan: Refactor: extract shared DUMMY_DIGEST timing-safe placeholder constant

Issue: [137-refactor-extract-shared-dummy-digest-timing-safe-placeholder-constant.md](../issues/137-refactor-extract-shared-dummy-digest-timing-safe-placeholder-constant.md)

## Overview
`AuthService` and `AuthorizationRequestService` each declare an identical `DUMMY_DIGEST` bcrypt hash and repeat the same "compare against dummy when the row is missing" pattern inline. This is a single-owner backend refactor: extract both into a new module-local file and update both call sites to use it, with no behavior change.

See [backend.md](backend.md) for the full plan.
