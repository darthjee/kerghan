# Plan: Standalone: verify the default-user effective client IP on Linux and end to end

Issue: [384-standalone-verify-the-default-user-effective-client-ip-on-linux-and-end-to-end.md](../../issues/384-standalone-verify-the-default-user-effective-client-ip-on-linux-and-end-to-end.md)

## Overview
Add a verification script with a probe mode (replicates the #371 measurement) and an end-to-end mode (checks `status.json` against a released image). Document a per-check checklist in `docs/agents/standalone.md`. Once the user reports results, update the "Effective client IP" section and the caveats. The user runs the checks; the agent only builds the tooling and records the results.

## Context
- #371 measured the effective IP only on Docker Desktop for macOS (arm64), using `darthjee/vault:0.1.0` with a probe inner service published like Tent (`ports: ["80:80"]`). See "Effective client IP" in `docs/agents/standalone.md`.
- The backend does not expose the IP it sees, but Tent's `SetClientIpMiddleware` passes Tent's socket `REMOTE_ADDR` through as `X-Forwarded-For` (one entry) and `KERGHAN_TRUSTED_PROXY_HOPS` defaults to `1`. So the address a probe service sees at Tent's position is the address the backend sees.
- The open checks are listed under "Caveats" in `docs/agents/standalone.md` (tracked in #384).
- The end-to-end check must use the next released `kerghan-standalone` tag that includes #368–#372, not a locally built image.

## Steps

- [01 — Add the client-IP verification script](standalone/01-verification-script.md)
- [02 — Document the verification checklist](standalone/02-verification-checklist.md)
- [03 — Record the reported results](standalone/03-record-results.md)

## CI Checks
- `standalone/`: `bats standalone/test` via the `bats/bats:1.11.0` image, e.g. `docker run --rm -v "$PWD:/code" -w /code bats/bats:1.11.0 standalone/test` (CI job: `standalone_tests`). Run this only if the script gets bats tests; otherwise it is a regression check.
- `shellcheck` on the new script, run through a container (never on the host).

## Notes
- Step 03 is blocked on input from the user: results from their Linux host (native Docker, with and without Sysbox, Engine 28+), a second LAN machine, and the macOS machine, plus a released image for the end-to-end check. An autonomous run can finish steps 01–02 and must leave step 03 for when results arrive, e.g. as a follow-up commit on this branch or in a later PR. It must never invent results.
- If a result shows that `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, `KERGHAN_TRUSTED_PROXY_HOPS` or the default `bind` is wrong, open a separate issue and link it from the docs. Do not change behavior here.
- A `make` target for the script would touch the `Makefile`, which belongs to the `infra` agent. Leave it out unless it is needed; documenting the direct invocation is enough.
- The scripts must never install anything on the host. They use `docker` and `curl` only, plus `vault`/`kerghan` for the end-to-end mode, which the user already has installed.
