# Plan: Backend: boot-time sync of the default user and edit blocking

Issue: [369-backend-boot-time-sync-of-the-default-user-and-edit-blocking.md](../../issues/369-backend-boot-time-sync-of-the-default-user-and-edit-blocking.md)

## Overview

Add a `DefaultUserService` to the auth module that synchronizes the default user from `DefaultUserConfig` at application boot and holds its id. `AccountService`, `AdminService` and `PasswordResetService` then use it to refuse writes of the default user's managed fields with `409 DEFAULT_USER_MANAGED`, following `docs/agents/specs/default-user/boot-sync.md` and `edit-blocking.md`. Backend only.

See [backend.md](backend.md) for the full plan.
