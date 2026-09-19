# Plan: Refactor: extract shared boolean-metadata-reading helper from AdminGuard/JwtGuard/SkipCacheInterceptor

Issue: [139-refactor-extract-shared-boolean-metadata-reading-helper-from-adminguard-jwtguard.md](../issues/139-refactor-extract-shared-boolean-metadata-reading-helper-from-adminguard-jwtguard.md)

## Overview
Extract the `Boolean(reflector.getAllAndOverride(...))` pattern duplicated across `AdminGuard`, `JwtGuard`, and `SkipCacheInterceptor` into one shared `backend/src/core/` helper, with no behavior change.

See [backend.md](backend.md) for the full plan.
