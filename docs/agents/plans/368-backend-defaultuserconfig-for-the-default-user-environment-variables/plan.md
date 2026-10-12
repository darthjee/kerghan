# Plan: Backend: DefaultUserConfig for the default-user environment variables

Issue: [368-backend-defaultuserconfig-for-the-default-user-environment-variables.md](../../issues/368-backend-defaultuserconfig-for-the-default-user-environment-variables.md)

## Overview
Add `DefaultUserConfig` in the backend auth module, the only reader of the `KERGHAN_DEFAULT_USER_*` variables. It is built once at boot through a factory provider and validates fail-fast. The password minimum length moves to a shared constant, and the default-user spec records the four clarifications from the issue.

See [backend.md](backend.md) for the full plan.
