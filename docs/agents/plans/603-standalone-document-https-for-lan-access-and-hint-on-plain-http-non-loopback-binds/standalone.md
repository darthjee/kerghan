# Standalone Plan: Standalone: document HTTPS for LAN access and hint on plain-HTTP non-loopback binds

Main plan: [plan.md](plan.md)

## Overview

Make LAN access over HTTPS easy to set up and the plain-HTTP limit visible, without weakening the
session cookies: a hint on `kerghan up`, a warning for auto-login behind a proxy, and a TLS recipe
page.

## Context

- #600 passes `KERGHAN_COOKIE_SECURE=false` on loopback binds; #601 passes `loopback` on
  non-loopback binds with a non-`https` effective `FRONTEND_BASE_URL`; an `https` URL gives `true`
  (`wanted_cookie_secure` in `standalone/bin/kerghan`).
- LAN clients over `http://<LAN IP>:<port>` get `Secure` cookies and login fails silently.
- The original opt-in (`KERGHAN_COOKIE_SECURE=false` on non-loopback binds) was rejected; the
  variable stays client-managed (`CLIENT_MANAGED_KEYS`, `refuse_client_managed_keys`).
- Existing patterns: `warn` / `hint` helpers (stderr), the auto-login-on-non-loopback warning in
  `cmd_up` (step 2, before "3. Compare with the running instance") and in `cross_key_warnings`
  (used by `configure`), `effective_frontend_base_url <port>`, `is_loopback`.

## Steps

- [01 — Client hint and warning](standalone/01-client-hint-and-warning.md)
- [02 — bats coverage](standalone/02-bats-coverage.md)
- [03 — HTTPS recipe and docs updates](standalone/03-https-docs.md)

## CI Checks

- `standalone/test`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/test` on bash 3.2: `docker-compose run --rm standalone_tests_bash32` (CI job:
  `standalone_tests_bash32`)

## Notes

- Never run `bats` or `bash` tooling on the host: use the `docker-compose` services above.
- The client must stay bash 3.2 compatible (no associative arrays, no `${var,,}`, etc.).
- The hint and warning go to stderr only; stdout ("Kerghan is running at …", "Kerghan is already
  running at …") and exit codes must not change.
- The README edit (a link in "Run Kerghan standalone") is a root-level file; keep it to the link
  sentence so the architect review is trivial.
- After the PR is ready, request a `security` agent review: the recipe's guidance (CA trust,
  exposure, mandatory `auto-login=false`) and the warning's condition.
