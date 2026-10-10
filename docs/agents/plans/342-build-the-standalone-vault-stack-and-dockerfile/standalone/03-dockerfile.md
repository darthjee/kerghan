# Dockerfile and ignore file

Write `dockerfiles/kerghan_standalone/Dockerfile` (build context: repo root):

1. `frontend` stage: `FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.0 AS frontend`;
   copy `frontend/` (package.json, yarn.lock, then sources), install dependencies (follow the
   pattern of `dockerfiles/vite_kerghan/Dockerfile` / the CI `upload_fe_files` job), run
   `yarn build` → `dist/`.
2. `standalone` target: `FROM darthjee/vault:0.1.0 AS standalone`;
   `ARG TARGETARCH` (no default, as in `production_kerghan`), `ARG KERGHAN_VERSION=latest`;
   `COPY standalone/vault/ /vault/`; `COPY --from=frontend <dist> /vault/tent/static/`;
   `RUN` that writes `/vault/.env` with `TENT_IMAGE=darthjee/tent:1.0.3` when `TARGETARCH` is
   `amd64` (or empty), `TENT_IMAGE=darthjee/tent:1.0.3-arm64` when `arm64`, failing the build on
   any other value, plus `KERGHAN_VERSION=${KERGHAN_VERSION}`. No secret anywhere.
3. `standalone-offline` target: `FROM standalone AS standalone-offline`;
   `COPY standalone/images/ /vault/images/` (tarballs produced by #343's CI; document that the
   folder must exist with `*.tar` files before building this target); `ENV COMPOSE_UP_ARGS="--pull never"`.
   Defined only — not built or tested in this issue. Add `standalone/images/` to `.gitignore`.

Add `dockerfiles/kerghan_standalone/Dockerfile.dockerignore` (BuildKit's per-Dockerfile ignore
file, so the root context of other images is untouched): exclude `.git`, `**/node_modules`,
`frontend/dist`, `frontend/coverage`, `docker_volumes`, `.env`, `*.env`, `.env.*`, `.vault.env`,
`**/*.env` and `standalone/vault/.env` (the image writes its own).

## Files to Change

- `dockerfiles/kerghan_standalone/Dockerfile` — new, three stages as above.
- `dockerfiles/kerghan_standalone/Dockerfile.dockerignore` — new.
- `.gitignore` — ignore `standalone/images/`.
