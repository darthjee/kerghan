# darthjee/kerghan-standalone: the whole Kerghan stack in one Vault
# (Docker-in-Docker) container. Build context: the repo root.
#
#   docker build -f dockerfiles/kerghan_standalone/Dockerfile \
#     --target standalone --build-arg KERGHAN_VERSION=<v> \
#     -t darthjee/kerghan-standalone:<v> .
#
# BuildKit is required (TARGETARCH / BUILDPLATFORM and the per-Dockerfile
# Dockerfile.dockerignore). No secret is baked into any stage.
#
# Specs: see the "Standalone distribution" entry in docs/agents/specs.md.

#######################
# Frontend build (architecture-independent output, so it runs on the build
# platform). Note: darthjee/vite_kerghan-base:0.1.0 is published for amd64
# only (arm64 lives under the -arm64 tag), so an arm64 build host runs this
# stage under emulation.
FROM --platform=$BUILDPLATFORM darthjee/vite_kerghan-base:0.1.0 AS frontend

USER node
WORKDIR /home/node/app

COPY --chown=node:node frontend/package.json frontend/yarn.lock /home/node/app/
RUN yarn install --frozen-lockfile --non-interactive

COPY --chown=node:node frontend/ /home/node/app/
RUN yarn build

#######################
# Online image: inner images are pulled by Vault on first start.
FROM darthjee/vault:0.1.0 AS standalone

# No default: a default would override BuildKit's automatic TARGETARCH.
# The legacy builder leaves it empty, which selects amd64 below.
ARG TARGETARCH
ARG KERGHAN_VERSION=latest

COPY standalone/vault/ /vault/
COPY --from=frontend /home/node/app/dist/ /vault/tent/static/
# Kerghan's custom Tent middlewares (runtime code only, no tests), used by
# the standalone Tent rules. Mounted into the stock Tent image.
COPY proxy/extension/loader.php /vault/tent/extension/loader.php
COPY proxy/extension/lib/ /vault/tent/extension/lib/

# /vault/.env is read by `docker compose` automatically. It holds no secrets.
RUN set -e; \
    case "${TARGETARCH}" in \
      ""|amd64) tent_image=darthjee/tent:1.0.3 ;; \
      arm64) tent_image=darthjee/tent:1.0.3-arm64 ;; \
      *) echo "Unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    printf 'TENT_IMAGE=%s\nKERGHAN_VERSION=%s\n' "$tent_image" "$KERGHAN_VERSION" > /vault/.env; \
    cat /vault/.env

#######################
# Offline image: inner images preloaded from /vault/images/*.tar.
# standalone/images/ must exist and hold the `docker save` tarballs of
# darthjee/kerghan:<v>, mysql:9.3.0 and the matching Tent tag before building
# this target (produced by CI).
FROM standalone AS standalone-offline

COPY standalone/images/ /vault/images/
ENV COMPOSE_UP_ARGS="--pull never"
