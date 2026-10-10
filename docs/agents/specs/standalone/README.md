# Standalone distribution — specs

Temporary feature specs for epic #336, following the [specs hub](../../specs.md). While this
folder exists it is the source of truth for the standalone distribution: every sub-issue of the
epic builds against it and does not redefine what it decides. A sub-issue that needs to change a
decision updates the relevant file here in the same PR.

## Overview and purpose

Ship Kerghan as two public Docker images, plus a client and an installer:

- **`darthjee/kerghan`**: the production backend image (NestJS, runs migrations on boot), built
  from `dockerfiles/production_kerghan/Dockerfile`. It has two consumers: Render deploys it
  directly, and the standalone stack bakes it in. One image, two consumers.
- **`darthjee/kerghan-standalone`**: a Vault-based image (`FROM darthjee/vault`) running the whole
  stack in one container: MySQL, the backend, and Tent serving the built frontend, exposed on a
  single port. It comes in an online and an offline variant.
- **`kerghan`**: a thin bash client wrapping the `vault` CLI, installed by `install.sh`, so a user
  runs all of Kerghan with one command.

The goal is one artifact that runs all of Kerghan for self-hosting and local use.

## Product decision

Epic #336. The decisions recorded in these files come from that epic and from the verifications
done while enhancing #337. Re-discussing them is out of scope for the sub-issues.

## Scope

### In scope

- Releasing `darthjee/kerghan` (multi-arch) and deploying Render from it by image URL.
- Renaming the image tags (`darthjee/kerghan` dev tag becomes `darthjee/dev_kerghan`,
  `darthjee/production_kerghan` becomes `darthjee/kerghan`).
- The `darthjee/kerghan-standalone` image (online and offline variants, multi-arch) and its inner
  compose stack.
- The standalone environment-variable contract.
- The `kerghan` client, its `~/.kerghan/` configuration, the installer and the release assets.

### Out of scope

- Navi / cache warmer.
- phpMyAdmin (out for now).
- Email / SMTP: `KERGHAN_EMAILS_ENABLED` stays off in standalone.
- The production frontend: `kerghan.ffavs.net` keeps its current SSH deploy of the Vite build
  and the Tent proxy on the PHP host. Only the backend moves to the released image on Render.
- Running the standalone image in production. Render never runs the Vault image (it needs Sysbox
  or `--privileged`).
- Shell completion, a backup command (`mysqldump`), multiple instances per host.

## Alternatives

- **Chosen: Vault image (`darthjee/kerghan-standalone`).** One image, one container, one exposed
  port. It reuses the compose stack and each service's own image unchanged, and the `kerghan`
  client can wrap the `vault` CLI. Accepted costs: it needs Sysbox or `--privileged` (so no
  Render, no rootless Docker, no Windows CLI), Docker-in-Docker adds weight, and the offline
  variant stores image data twice.
- **Possible later fallback (out of scope): a released compose bundle.** The inner compose file
  plus the frontend and Tent files as a release asset, run with `docker compose` on the host. No
  privileges needed. The compose file inside the standalone image is essentially this bundle.
- **Rejected:**
  - A fat single image (MySQL, Node and Tent under a process supervisor): a hand-rolled
    multi-process image that duplicates the official images and makes upgrades harder.
  - An external database (only the backend and Tent): not standalone.
  - Helm or Kubernetes manifests: overkill for self-hosting and local use.

## Repo layout

| Path | Content | Owner |
|---|---|---|
| `standalone/vault/` | The inner compose file and `tent/` (Tent standalone configuration; the built frontend is added at image build time). Copied to `/vault` in the image. | `standalone` agent (#338) |
| `standalone/bin/kerghan` | The client script. | `standalone` |
| `standalone/install.sh` | The installer. | `standalone` |
| `standalone/kerghan.env.example` | Example env file, shipped as a release asset. | `standalone` |
| `dockerfiles/kerghan_standalone/Dockerfile` | The standalone image, targets `standalone` and `standalone-offline`. | `standalone` |
| `.circleci/config.yml`, `bin/image.sh`, `scripts/deploy.sh` | Release jobs and the Render deploy. | `infra` |

## Known limitations

- **HTTPS.** The access-token cookie is always `Secure`. Browsers accept it on
  `http://localhost`, but not over plain HTTP on a LAN IP or hostname, where login silently
  fails. Standalone is documented to run on `localhost`, or behind the user's own TLS reverse
  proxy. Proper handling is future work, outside this epic.
- **Demo user.** The demo-seed migration keeps creating the `demo` user in standalone databases,
  unchanged (its password falls back to a non-working placeholder because `KERGHAN_DEMO_PASSWORD`
  is not passed). Special handling comes in a future epic, where standalone can run without a
  password.
- **Older browsers and `OriginGuard`.** Covered by the client's default `FRONTEND_BASE_URL`; see
  [stack.md](stack.md#same-origin-and-originguard).
- **One instance per host**, Linux and macOS hosts only, Docker with Sysbox or `--privileged`.

## Lifecycle

The hub's single "last sub-issue" step is split across two sub-issues, which is not a deviation
from the convention:

- **#347** folds the lasting content into the permanent docs (README "Run Kerghan standalone",
  `environment-variables.md` "Standalone", `architecture/infra.md`, `folder-structure.md`,
  `external.md`).
- **#348** deletes this folder and moves the hub entry from "Active specs" to "Completed specs".

Root instruction files and agents link only to the hub entry, never to this folder.

## Sub-issue map

| # | Sub-issue | Owner | Reads | Depends on |
|---|---|---|---|---|
| #337 | Write the standalone specs | architect | all | none |
| #338 | Add the standalone specialist agent | architect | README | #337 |
| #339 | Rename image tags: dev_kerghan and kerghan | infra | [images.md](images.md) | #337 |
| #340 | Release darthjee/kerghan to Docker Hub (multi-arch) | infra | [images.md](images.md) | #339 |
| #341 | Deploy Render from the darthjee/kerghan image | infra | [render.md](render.md), [images.md](images.md) | #340 |
| #342 | Build the standalone Vault stack and Dockerfile | standalone | [stack.md](stack.md), [variables.md](variables.md) | #338, #340 |
| #343 | Release darthjee/kerghan-standalone (online and offline) | infra | [images.md](images.md), [stack.md](stack.md) | #342 |
| #344 | Add the kerghan client CLI | standalone | [client.md](client.md), [variables.md](variables.md) | #342 |
| #345 | Read client settings from ~/.kerghan/config | standalone | [config.md](config.md) | #344 |
| #346 | Add the kerghan installer and release assets | standalone + infra | [installer.md](installer.md) | #343, #344 |
| #347 | Move standalone documentation into the permanent docs | architect | all | #341, #345, #346 |
| #348 | Remove the standalone specs | architect | README | #347 |

Two tracks run in parallel after #338: the Render track (#339, #340, #341) and the standalone
track (#342, #344, #345). They meet at #343 and #346.

## Index

| File | Content |
|---|---|
| [images.md](images.md) | Image names and tags, versioning, pinned images, multi-arch, CI release order |
| [render.md](render.md) | Deploying Render by image URL, rollback, the manual Render checklist |
| [stack.md](stack.md) | The inner compose stack, the Dockerfile targets, offline preload, same-origin, edge cases |
| [variables.md](variables.md) | The environment-variable contract |
| [client.md](client.md) | The `kerghan` client commands and behavior |
| [config.md](config.md) | The `~/.kerghan/` layout and the `config` file |
| [installer.md](installer.md) | `install.sh` and the release assets |

## Required tests

This file has none of its own. Each file above ends with its own "Required tests" section.
