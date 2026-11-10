# Plan: Repositories: Auth — GitHub handle on the account

Issue: [460-repositories-auth-github-handle-on-the-account.md](../../issues/460-repositories-auth-github-handle-on-the-account.md)

## Overview

This plan adds an optional, normalised and validated `github_handle` to `auth_users`, owned by the Auth module:

- a handle-only path on `PATCH /auth/account.json`, with no password, no abuse guard, and no default-user block;
- a new `POST /auth/account/mine.json` read route;
- an exported `AccountHandleService` for the Repositories module (#463).

It is backend only. The admin contract and the existing Account form stay unchanged.

See [backend.md](backend.md) for the full plan.
