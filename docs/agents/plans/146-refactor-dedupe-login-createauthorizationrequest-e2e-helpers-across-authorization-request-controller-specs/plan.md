# Plan: Refactor: dedupe login()/createAuthorizationRequest() e2e helpers across authorization-request controller specs

Issue: [146-refactor-dedupe-login-createauthorizationrequest-e2e-helpers-across-authorization-request-controller-specs.md](../../issues/146-refactor-dedupe-login-createauthorizationrequest-e2e-helpers-across-authorization-request-controller-specs.md)

## Overview
Move the duplicated `createAuthorizationRequest` and `login` e2e helpers into the shared `authorization-request.controller.e2e-test-support.ts`, taking the target `app` as an explicit parameter, and have the approver, abuse-hardening and poll specs import them.

See [backend.md](backend.md) for the full plan.
