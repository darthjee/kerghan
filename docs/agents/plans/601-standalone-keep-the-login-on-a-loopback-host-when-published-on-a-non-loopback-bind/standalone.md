# Standalone Plan: Standalone: keep the login on a loopback host when published on a non-loopback bind

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce `KERGHAN_COOKIE_SECURE` on every `vault up`:
  - loopback bind: `false` without an `https` effective `FRONTEND_BASE_URL`, else `true` (unchanged);
  - non-loopback bind: `loopback` without an `https` effective `FRONTEND_BASE_URL` (**new**, was
    `true`), else `true`.
- The backend treats `loopback` per request; an older backend image reads it as `Secure` (safe).
- Recreate reason when the wanted value becomes `loopback`: `allowing login over plain HTTP on
  loopback hosts`.

## Implementation Steps

### Step 1 — Client value, recreate reason and tests

In `standalone/bin/kerghan`:

- `wanted_cookie_secure` (~line 535): on a non-loopback bind, print `loopback` when the effective
  `FRONTEND_BASE_URL` is not `https://`, else `true`. Update its comment.
- `settings_reason` (~line 618): the cookie branch prints, by wanted value:
  - `false` → `allowing login over plain HTTP on loopback` (unchanged);
  - `loopback` → `allowing login over plain HTTP on loopback hosts`;
  - `true` → `requiring HTTPS for the session cookies` (unchanged).
- `running_cookie_secure` needs no change (missing → `true`, inspect failure → `unknown`).
- Update the comment above `up_instance`'s `-e KERGHAN_COOKIE_SECURE` (~line 1974) and the help
  text if it describes the cookie values.
- Keep bash 3.2 compatibility.

Tests (`standalone/test/`):

- `cookie_secure.bats`: `bind=0.0.0.0` (and a specific LAN IP) without `https` → `loopback`; with an
  `https` `FRONTEND_BASE_URL` in `kerghan.env` → `true`; a running non-loopback instance with
  `KERGHAN_COOKIE_SECURE=true` (or missing) is recreated with the new reason; one with `loopback`
  is not recreated.
- `helpers/setup.bash` `default_user_args`: the default for auto-login off (non-loopback default
  bind) becomes `loopback`.
- Fix any expectation that a non-loopback bind passes `true`, e.g. `auto_login.bats` (~line 126)
  and `recreate_settings.bats`.

### Step 2 — Docs

- `docs/agents/standalone/release-and-caveats.md` (~line 39): on a non-loopback bind, browsing from
  the host over `http://127.0.0.1:<port>` / `http://localhost:<port>` now keeps the login in every
  browser; LAN hosts still need a TLS reverse proxy (#603 tracks an opt-in); behind a TLS proxy set
  an `https` `FRONTEND_BASE_URL` (the client then passes `true`); the accepted port-scope note; the
  minimum image version for the fix.
- `docs/agents/standalone/client.md` (~lines 44, 119, 221): `-e KERGHAN_COOKIE_SECURE=<true|false|loopback>`
  and the decision table.
- `docs/agents/environment-variables/standalone.md` (~line 26): the client-managed row with the
  three values.
- `docs/agents/standalone/client-config.md`, `client-config/configure.md`, `client-config/files.md`:
  only if they describe the values (the refused-key text stays).

## Files to Change

- `standalone/bin/kerghan` — `wanted_cookie_secure`, `settings_reason`, comments/help.
- `standalone/test/cookie_secure.bats`, `standalone/test/helpers/setup.bash`,
  `standalone/test/auto_login.bats`, `standalone/test/recreate_settings.bats` — tests.
- `docs/agents/standalone/release-and-caveats.md`, `docs/agents/standalone/client.md`,
  `docs/agents/environment-variables/standalone.md` (+ client-config pages if needed) — docs.

## CI Checks

- `standalone`: `docker-compose run --rm standalone_tests` and
  `docker-compose run --rm standalone_tests_bash32` (CI jobs: `standalone_tests`,
  `standalone_tests_bash32`).

## Notes

- `standalone/vault/docker-compose.yml` already passes `KERGHAN_COOKIE_SECURE` through (#600); no
  inner-stack change.
- `standalone/scripts/verify_client_ip.sh` already reports the variable; no change.
