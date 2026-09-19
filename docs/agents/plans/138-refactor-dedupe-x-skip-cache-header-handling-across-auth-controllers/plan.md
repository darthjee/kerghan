# Plan: Refactor: dedupe X-Skip-Cache header handling across auth controllers

Issue: [138-refactor-dedupe-x-skip-cache-header-handling-across-auth-controllers.md](../issues/138-refactor-dedupe-x-skip-cache-header-handling-across-auth-controllers.md)

## Overview
Single-owner plan handled entirely by `backend`: fix `admin.controller.ts`'s redeclared `SKIP_CACHE_HEADER` constant and replace every hand-written `res.set(SKIP_CACHE_HEADER, 'true')` across the three auth controllers with a shared `@SkipCache()` decorator + `NestInterceptor`.

See [backend.md](backend.md) for the full plan.
