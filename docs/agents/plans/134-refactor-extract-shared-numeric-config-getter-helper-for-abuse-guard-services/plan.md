# Plan: Refactor: extract shared numeric-config getter helper for abuse-guard services

Issue: [134-refactor-extract-shared-numeric-config-getter-helper-for-abuse-guard-services.md](../issues/134-refactor-extract-shared-numeric-config-getter-helper-for-abuse-guard-services.md)

## Overview
Add a shared `getNumberConfig` helper under `backend/src/core/` and have both abuse-guard services call it instead of their six hand-rolled private numeric getters.

See [backend.md](backend.md) for the full plan.
