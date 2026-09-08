# Plan: Backend Authorization Request Entity Migration And Create Poll Endpoints

Issue: [60-backend-authorization-request-entity-migration-and-create-poll-endpoints.md](../../issues/60-backend-authorization-request-entity-migration-and-create-poll-endpoints.md)

## Overview

Adds the requesting-device half of the login-by-authorization flow: a new `auth_authorization_requests`
entity/table modeled on the existing password-reset-token pattern, an internal
`AuthorizationRequestService` with an atomic create/poll status machine, and two `@Public()` endpoints.
Also extracts `AuthController`'s inline cookie/serialize logic into a shared helper so both the
password-login and device-authorization response shapes stay identical.

See [backend.md](backend.md) for the full plan.
