# Plan: Prune expired/revoked refresh tokens and stale auth_sessions rows

Issue: [325-prune-expired-revoked-refresh-tokens-and-stale-auth-sessions-rows.md](../../issues/325-prune-expired-revoked-refresh-tokens-and-stale-auth-sessions-rows.md)

## Overview
Bound the Auth module's table growth. Drop the write-only `auth_sessions` table. When a token is minted, delete the minting user's expired refresh-token rows and expired/used password-reset-token rows. This is backend-only work.

See [backend.md](backend.md) for the full plan.
