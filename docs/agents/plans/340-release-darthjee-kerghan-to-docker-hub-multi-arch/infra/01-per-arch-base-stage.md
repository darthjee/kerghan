# Per-arch base stages in the production Dockerfile

`darthjee/production_kerghan-base` has a different tag per architecture, so a single multi-platform
`buildx` build must pick the base tag from the target platform. Replace the single base `FROM` with
one stage per architecture and select it through `TARGETARCH`:

```dockerfile
ARG BASE_VERSION=latest
ARG TARGETARCH=amd64
FROM darthjee/scripts:0.8.0 as scripts
FROM darthjee/production_kerghan-base:${BASE_VERSION} as base-amd64
FROM darthjee/production_kerghan-base:${BASE_VERSION}-arm64 as base-arm64
FROM base-${TARGETARCH} as base
```

The rest of the file (`builder` stage, final image, entrypoint) stays unchanged and keeps using
`base`. BuildKit only builds the stages the target needs, so an amd64 build never pulls the arm64 base
and vice versa.

Check locally, through Docker only:
- `docker-compose build base_prod_build` still builds `darthjee/kerghan`.
- `docker buildx build --platform linux/arm64 -f dockerfiles/production_kerghan/Dockerfile --build-arg BASE_VERSION=0.1.0 .`
  resolves `production_kerghan-base:0.1.0-arm64`. QEMU may be needed on an amd64 host.

## Files to Change
- `dockerfiles/production_kerghan/Dockerfile` — global `ARG TARGETARCH=amd64`, `base-amd64` / `base-arm64` stages, `base` selected via `base-${TARGETARCH}`.
