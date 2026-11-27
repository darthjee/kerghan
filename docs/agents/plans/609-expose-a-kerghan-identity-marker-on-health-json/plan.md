# Plan: Expose a Kerghan identity marker on /health.json

Issue: [609-expose-a-kerghan-identity-marker-on-health-json.md](../../issues/609-expose-a-kerghan-identity-marker-on-health-json.md)

## Overview

The backend adds an `app: "kerghan"` identity marker and the release `version` to both probes. `/ready.json` gains a `workers` component check and a `degraded` status. `kerghan diagnose` stops matching the exact body `{"status":"ok"}` and identifies Kerghan by `app`, while still accepting the legacy body from already released images. The backend-down case (Tent synthesizing the marker) is out of scope: it is #613, blocked on darthjee/tent#315. No proxy file changes here.

This should ship in the same release as #610 (`kerghan diagnose`, unreleased at `0.10.2`), so no released client ever carries the exact-body check.

## Agents involved

- [backend](backend.md)
- [standalone](standalone.md)

## Shared contracts

The probe response bodies. The backend produces them, `diag_classify` / `cmd_diagnose` and `smoke_test.sh` consume them. Key order is not part of the contract, and consumers must not depend on it.

```text
GET /health.json
  200 {"app":"kerghan","status":"ok","version":"<semver>"}

GET /ready.json
  200 {"app":"kerghan","status":"ok","version":"<semver>","checks":{"database":"up","workers":"up"}}
  200 {"app":"kerghan","status":"degraded","version":"<semver>","checks":{"database":"up","workers":"down"}}
  503 {"app":"kerghan","status":"error","version":"<semver>","checks":{"database":"down","workers":"up"|"down"}}
```

- `app`: always the literal string `"kerghan"`.
- `version`: string, the `version` field of `backend/package.json`, read once at boot. The key is **omitted** (not `null`, not `""`) when the file cannot be read.
- `status` (backend): `"ok" | "degraded" | "error"`. Derivation: `error` if `checks.database !== "up"`, else `degraded` if `checks.workers !== "up"`, else `ok`. `"down"` is reserved for the Tent-synthesized body in #613 and never produced by the backend.
- `checks` values: `"up" | "down"` from the backend. `"unknown"` is reserved for #613.
- HTTP codes: `/health.json` is always `200` when the backend answers. `/ready.json` is `200` for `ok`/`degraded` and `503` for `error`.
- Both routes keep `@Public()` and `@CachePolicy(CacheClass.Never)` (`X-Skip-Cache`).
- Bodies are small (under 150 bytes). `probe_http` cuts `PROBE_BODY` at 200 characters, so the whole body is always available to the client.

Consumer rules (standalone), so they stay compatible with #613:

- Kerghan if the body has `"app":"kerghan"`, whatever the status code.
- Kerghan (legacy image) if the code is `200` and the body is exactly `{"status":"ok"}` once whitespace is stripped (no `app`).
- Anything else is foreign.
- A `5xx` from `/health.json` with `"app":"kerghan"` means Kerghan with the backend down (`[FAIL]`, exit 4). It cannot occur until #613, but it is handled and tested now.
- `/ready.json`: `200` with `"status":"degraded"` is `[warn]` (workers down), not a failure. `200` otherwise is ready, `503` is not ready (exit 4), and anything else is `readiness unknown`.
