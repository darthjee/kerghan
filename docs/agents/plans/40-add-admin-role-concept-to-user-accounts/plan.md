# Plan: Add admin role concept to user accounts

Issue: [40-add-admin-role-concept-to-user-accounts.md](../../issues/40-add-admin-role-concept-to-user-accounts.md)

## Overview

Add a minimal admin concept to the Auth module: a boolean `is_admin` column on `auth_users`,
an `isAdmin` claim carried in the signed access token, and an `@AdminOnly()` decorator + global
`AdminGuard` in `core/` that mirrors the existing `@Public()` / `JwtGuard` pattern. First-admin
provisioning is a documented manual `UPDATE`; local development gets the seeded `demo` user
promoted to admin via a dev-only migration. No admin UI, routes, or features ship here.

All work is within the `backend` agent's scope.

See [backend.md](backend.md) for the full plan.
