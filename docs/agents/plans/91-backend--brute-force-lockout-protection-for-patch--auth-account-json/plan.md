# Plan: Backend: brute-force lockout protection for PATCH /auth/account.json

Issue: [91-backend--brute-force-lockout-protection-for-patch--auth-account-json.md](../issues/91-backend--brute-force-lockout-protection-for-patch--auth-account-json.md)

## Overview

Add a dedicated abuse-guard mechanism for `PATCH /auth/account.json`, backed by its own tracking
table (`auth_account_edit_lockouts`), counting any failed update attempt (wrong `currentPassword`,
duplicate `username`/`email`) per authenticated user and returning a distinct `423 Locked` error
once the configured threshold is hit. Backend-only change.

See [backend.md](backend.md) for the full plan.
