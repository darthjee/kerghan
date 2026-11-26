# Plan: Standalone: make the advertised URL reach the instance

Issue: [598-standalone-make-the-advertised-url-reach-the-instance.md](../../issues/598-standalone-make-the-advertised-url-reach-the-instance.md)

## Overview

Change the one URL rule (`advertised_url`) so it returns the published address instead of
`localhost`, route the derived `FRONTEND_BASE_URL` and the wizard default through it, adjust the
messages that still point at `localhost`, make `kerghan diagnose` say when the advertised URL is
the published address, then update tests, CI scripts, `config.example`, the README and the docs.

## Context

- `localhost` resolves to `::1` first on macOS and many Linux hosts, where Docker does not listen,
  so `http://localhost:<port>` can reach another process (macOS AirPlay on 5000/7000).
- V1 is done and #600/#601 made plain-HTTP login work on `127.0.0.1` in every browser, so option A
  (advertise the bind address) was chosen; IPv6 publishing (option B) is not done.
- `advertised_url <bind> <port>` (`standalone/bin/kerghan`, from #597) is already the single place
  `up` and `diagnose` read the printed URL from. `published_probe_host <bind>` already maps
  `''`/`0.0.0.0` to `127.0.0.1` and returns the bind otherwise: exactly the new rule.
- No new recreate trigger: bind and port already recreate; a client upgrade changes the image.
  The pinned-`image-tag` case (instance keeps `FRONTEND_BASE_URL=http://localhost:<port>`) is an
  accepted, harmless gap. `KERGHAN_COOKIE_SECURE` must not change for any bind.
- A user-set `FRONTEND_BASE_URL` in `kerghan.env` is never rewritten, and does not change the
  printed URL.

## Steps

- [01 — Client: advertised URL and derived FRONTEND_BASE_URL](standalone/01-client-advertised-url.md)
- [02 — Tests](standalone/02-tests.md)
- [03 — CI scripts, config example and docs](standalone/03-scripts-and-docs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/`: `docker-compose run --rm standalone_tests_bash32` (CI job:
  `standalone_tests_bash32`)
- Shellcheck / Codacy on `standalone/bin/kerghan` and `standalone/scripts/*.sh`, as in previous
  standalone PRs.

## Notes

- Never run `bats`, `bash` tooling or `curl` on the host: always use the compose services above.
- Keep `standalone/bin/kerghan` bash 3.2-safe.
- With the new rule the advertised URL always equals diagnose's published-address probe, so
  diagnose's exit code 6 branch becomes unreachable today. Keep it (the issue keeps exit 6 for
  when they ever differ); do not add a test-only hook to reach it. Rewrite the existing exit-6
  tests to the new behaviour instead (see step 02).
- Release notes: mention that the `Kerghan is running at ...` message changed (scripts parsing it
  may break) and that users with auto-login off log in once on the new URL.
