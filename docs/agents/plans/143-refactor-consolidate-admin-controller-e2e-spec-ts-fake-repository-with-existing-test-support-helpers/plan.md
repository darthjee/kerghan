# Plan: Refactor: consolidate admin.controller.e2e-spec.ts fake repository with existing test-support helpers

Issue: [143-refactor-consolidate-admin-controller-e2e-spec-ts-fake-repository-with-existing-test-support-helpers.md](../../issues/143-refactor-consolidate-admin-controller-e2e-spec-ts-fake-repository-with-existing-test-support-helpers.md)

## Overview
Replace the three independently-diverged in-memory fake repositories used by the auth e2e specs with a single shared superset module, and move `admin.controller.e2e-spec.ts` onto the shared `buildTestApp()`. Backend-only, test-support code — no production code changes.

See [backend.md](backend.md) for the full plan.
