# Plan: Refactor: consolidate the two e2e buildTestApp() builders (auth.controller / authorization-request.controller test-support)

Issue: [164-refactor-consolidate-the-two-e2e-buildtestapp-builders-auth-controller-authorization-request-controller-test-support.md](../../issues/164-refactor-consolidate-the-two-e2e-buildtestapp-builders-auth-controller-authorization-request-controller-test-support.md)

## Overview
Extract the duplicated Nest test-module wiring from the two e2e `buildTestApp()` builders into one shared builder, and reduce the two existing functions to thin wrappers.

See [backend.md](backend.md) for the full plan.
