# Plan: Refactor: extract shared fake AuthorizationRequest row factory for service unit specs

Issue: [145-refactor-extract-shared-fake-authorizationrequest-row-factory-for-service-unit-specs.md](../../issues/145-refactor-extract-shared-fake-authorizationrequest-row-factory-for-service-unit-specs.md)

## Overview
Add a `buildFakeAuthorizationRequest` factory to the shared `AuthorizationRequestService` test-support module and replace the four inline fake-row literals in the service unit specs with calls to it. Test behavior is unchanged.

See [backend.md](backend.md) for the full plan.
