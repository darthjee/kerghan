# Plan: Backend: list & revoke sessions API

Issue: [322-backend-list-revoke-sessions-api.md](../../issues/322-backend-list-revoke-sessions-api.md)

## Overview
Give every refresh-token chain a stable session identity: a UUID plus `started_at`, set at login and carried over on rotation. Then expose three never-cached, authenticated `POST auth/sessions/*` endpoints to list the caller's active sessions, revoke one, and revoke all others.

See [backend.md](backend.md) for the full plan.
