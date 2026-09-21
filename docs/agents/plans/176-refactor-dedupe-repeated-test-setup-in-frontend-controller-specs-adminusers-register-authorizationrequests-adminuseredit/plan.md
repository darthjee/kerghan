# Plan: Refactor: dedupe repeated test setup in frontend controller specs (AdminUsers, Register, AuthorizationRequests)

Issue: [176-refactor-dedupe-repeated-test-setup-in-frontend-controller-specs-adminusers-register-authorizationrequests-adminuseredit.md](../../issues/176-refactor-dedupe-repeated-test-setup-in-frontend-controller-specs-adminusers-register-authorizationrequests-adminuseredit.md)

## Overview
Test-only refactor of three frontend controller specs. Each spec gets a local `buildController()` helper and/or shared `beforeEach` setup, and its repeated cases become table-driven or helper-generated. Assertions, test names and coverage stay the same; no production code changes. `AdminUserEditControllerSpec.js` is out of scope (already deduplicated by #172).

See [frontend.md](frontend.md) for the full plan.
