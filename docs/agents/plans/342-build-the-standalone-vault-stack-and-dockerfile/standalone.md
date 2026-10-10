# Standalone Plan: Build the standalone Vault stack and Dockerfile

Main plan: [plan.md](plan.md)

## Shared contracts

- You produce `standalone/scripts/smoke_test.sh` (executable; env inputs `IMAGE` default
  `darthjee/kerghan-standalone:dev`, `KERGHAN_VERSION` default `latest`, `SMOKE_PORT` default
  `3080`, `SKIP_BUILD`; exit `0` on success; always cleans up its container and volume).
- The image builds with
  `docker build -f dockerfiles/kerghan_standalone/Dockerfile --target standalone --build-arg KERGHAN_VERSION=<v> -t <IMAGE> .`
  from the repo root. The `infra` agent wires this and the script into `make build-standalone` /
  `make standalone-smoke`.

## Steps

- [01 — Tent standalone configuration](standalone/01-tent-configuration.md)
- [02 — Inner compose stack](standalone/02-inner-compose.md)
- [03 — Dockerfile and ignore file](standalone/03-dockerfile.md)
- [04 — Smoke-test script](standalone/04-smoke-test.md)
- [05 — Update the specs](standalone/05-update-specs.md)

## Notes

- Tent container paths (from the dev compose service): configuration at
  `/var/www/html/configuration/`, static files at `/var/www/html/static/`, cache at
  `/var/www/html/cache/`.
- The frontend build stage uses `FROM --platform=$BUILDPLATFORM` because the Vite output is
  architecture-independent; check that `darthjee/vite_kerghan-base:0.1.0` exists for the build
  host's platform (if it is amd64-only, an arm64 host builds under emulation or fails — note it
  in the README of the stack, don't work around it here).
- Never run `yarn`/`node` on the host; the frontend build happens only inside the Docker build.
- Out of scope: CI jobs, publishing, offline tarballs and offline tests (#343), the `kerghan`
  client and installer (#344+), `kerghan.env.example`.
