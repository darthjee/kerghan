# Standalone Plan: Safari cannot stay logged in to a standalone instance over plain HTTP

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produces `KERGHAN_COOKIE_SECURE`.** It is always passed with `-e` on `vault up`:
  - `false` iff `is_loopback "$bind"` and the effective `FRONTEND_BASE_URL` does not start with
    `https://`. The effective URL is the value set in `kerghan.env`, else the derived default.
  - `true` otherwise.
- **The backend treats only the exact string `false` as off.** Anything else, including unset, keeps
  `Secure`.
- **`standalone/vault/docker-compose.yml`** passes it through to the `kerghan` service by name only.

## Steps

- [01 — Client: decide, pass and recreate on the cookie setting](standalone/01-client-cookie-secure.md)
- [02 — Inner stack and verification scripts](standalone/02-inner-stack.md)
- [03 — Docs](standalone/03-docs.md)

## CI Checks

- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`).
- `standalone`: `docker-compose run --rm standalone_tests_bash32` (CI job: `standalone_tests_bash32`).

## Notes

- `standalone/bin/kerghan` must stay bash 3.2-compatible.
- **#595 (already on `main`) added `warn_port_conflict` before `up_instance` in `cmd_up`.** The new
  argument goes next to the auto-login one and leaves that call alone.
- **Manual verification, recorded in the PR:**
  - Safari, Chrome and Firefox: log in on `http://127.0.0.1:<port>` and `http://localhost:<port>`,
    refresh, then log out.
  - Upgrade from 0.10.2 with an existing Chrome session: `kerghan up` recreates the instance with the
    cookie reason, then refresh and logout work.
- **Request a `security` agent review** on the PR.
