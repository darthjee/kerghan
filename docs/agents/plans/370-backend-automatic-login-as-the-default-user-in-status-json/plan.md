# Plan: Backend: automatic login as the default user in status.json

Issue: [370-backend-automatic-login-as-the-default-user-in-status-json.md](../../issues/370-backend-automatic-login-as-the-default-user-in-status-json.md)

## Overview
When `DefaultUserConfig.isAlwaysAuthenticated()` is true, `POST /auth/status.json` logs a caller with no valid session and an allowed IP in as the default user, issuing a regular session and the same cookies as `login.json`. The work is backend-only.

See [backend.md](backend.md) for the full plan.
