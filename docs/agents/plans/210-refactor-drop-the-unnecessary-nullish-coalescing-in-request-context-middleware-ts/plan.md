# Plan: Refactor: Drop the unnecessary nullish coalescing in request-context.middleware.ts

Issue: [210-refactor-drop-the-unnecessary-nullish-coalescing-in-request-context-middleware-ts.md](../../issues/210-refactor-drop-the-unnecessary-nullish-coalescing-in-request-context-middleware-ts.md)

## Overview
Remove the `?? req.url` fallback from the access-log `path` in `RequestContextMiddleware`, and delete the spec that only exercises that fallback. This fixes Codacy's `@typescript-eslint/no-unnecessary-condition` (High) finding.

See [backend.md](backend.md) for the full plan.
