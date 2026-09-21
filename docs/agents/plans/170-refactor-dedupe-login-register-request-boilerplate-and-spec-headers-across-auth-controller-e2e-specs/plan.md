# Plan: Refactor: dedupe login/register request boilerplate and spec headers across auth.controller e2e specs

Issue: [170-refactor-dedupe-login-register-request-boilerplate-and-spec-headers-across-auth-controller-e2e-specs.md](../../issues/170-refactor-dedupe-login-register-request-boilerplate-and-spec-headers-across-auth-controller-e2e-specs.md)

## Overview
Test-only refactor inside `backend/src/auth/tests/`: add shared `loginAs` / `loginCookie` / `registerUser` / `useTestApp` helpers and use them across the auth e2e specs. Test behavior is unchanged.

See [backend.md](backend.md) for the full plan.
