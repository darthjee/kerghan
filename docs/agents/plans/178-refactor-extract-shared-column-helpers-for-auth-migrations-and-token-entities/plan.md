# Plan: Refactor: extract shared column helpers for auth migrations and token entities

Issue: [178-refactor-extract-shared-column-helpers-for-auth-migrations-and-token-entities.md](../../issues/178-refactor-extract-shared-column-helpers-for-auth-migrations-and-token-entities.md)

## Overview
Extract shared column-definition helpers for the auth create-table migrations and a shared abstract base for the two hashed-token entities, with no change to the produced database schema.

See [backend.md](backend.md) for the full plan.
