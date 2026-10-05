# Plan: Backend: "Keep me signed in" sessions

Issue: [319-backend-keep-me-signed-in-sessions.md](../../issues/319-backend-keep-me-signed-in-sessions.md)

## Overview
Add an optional strict-boolean `keepSignedIn` flag to password login and to the device
authorization-request create, persist it as `keep_signed_in` on refresh tokens and authorization
requests, and have `TokenService` pick between two env-configurable refresh-token TTLs (regular
7 days, persistent 30 days), carrying the flag over on every rotation.

See [backend.md](backend.md) for the full plan.
