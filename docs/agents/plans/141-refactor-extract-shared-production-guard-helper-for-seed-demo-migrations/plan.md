# Plan: Refactor: extract shared production-guard helper for seed/demo migrations

Issue: [141-refactor-extract-shared-production-guard-helper-for-seed-demo-migrations.md](../../issues/141-refactor-extract-shared-production-guard-helper-for-seed-demo-migrations.md)

## Overview
Extract the duplicated "refuse to run in production" guard block from the two demo/seed migrations into a single shared helper, so future demo/seed migrations can reuse it instead of copy-pasting the check.

See [backend.md](backend.md) for the full plan.
