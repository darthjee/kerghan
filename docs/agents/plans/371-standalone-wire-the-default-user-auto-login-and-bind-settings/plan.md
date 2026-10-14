# Plan: Standalone: wire the default user, auto-login and bind settings

Issue: [371-standalone-wire-the-default-user-auto-login-and-bind-settings.md](../../issues/371-standalone-wire-the-default-user-auto-login-and-bind-settings.md)

## Overview
Wire the backend's default user and automatic login into the standalone distribution. The work covers the compose pass-through, the default-user values in newly generated `kerghan.env` files, the new `auto-login` and `bind` client settings (with recreation on change and an unsafe-combination warning), the client-managed `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, the docs, the bats tests, and the effective-client-IP finding in the spec. Everything is within the standalone agent's scope.

See [standalone.md](standalone.md) for the full plan.
