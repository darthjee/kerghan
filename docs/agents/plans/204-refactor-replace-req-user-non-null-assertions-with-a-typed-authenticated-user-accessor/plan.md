# Plan: Refactor: Replace req.user! non-null assertions with a typed authenticated-user accessor

Issue: [204-refactor-replace-req-user-non-null-assertions-with-a-typed-authenticated-user-accessor.md](../issues/204-refactor-replace-req-user-non-null-assertions-with-a-typed-authenticated-user-accessor.md)

## Overview
Add a `@CurrentUser()` param decorator to the backend's `core/` module and use it in the four handlers that currently bypass TypeScript's null checking with `req.user!`, so the compiler — not an assertion — accounts for the authenticated user always being present on these guarded routes.

See [backend.md](backend.md) for the full plan.
