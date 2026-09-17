# Plan: Refactor: unused variable in mail.method.ts and unnecessary async in admin.service.ts

Issue: [110-refactor--unused-variable-in-mail-method-ts-and-unnecessary-async-in-admin-service-ts.md](../issues/110-refactor--unused-variable-in-mail-method-ts-and-unnecessary-async-in-admin-service-ts.md)

## Overview

Two small, unrelated code-quality fixes in the backend, both flagged by Codacy: rename an
interface parameter to satisfy the naming convention that silences unused-arg scanners, and
remove an unnecessary `async` keyword from a method that never awaits anything.

See [backend.md](backend.md) for the full plan.
