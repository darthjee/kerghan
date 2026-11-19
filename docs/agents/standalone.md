# Standalone Distribution

The permanent reference for running Kerghan standalone: the `darthjee/kerghan-standalone` image,
the `kerghan` client, its installer and the `~/.kerghan/` configuration. The user-facing summary
is the "Run Kerghan standalone" section of the [README](../../README.md#run-kerghan-standalone);
the environment-variable contract is in
[environment-variables.md](environment-variables.md#5-standalone-darthjeekerghan-standalone).
The `standalone` agent owns the files described here; the CI release jobs belong to `infra` (see
[architecture/infra/releases.md](architecture/infra/releases.md)).

## Overview

Kerghan ships as two public Docker images, plus a client and an installer:

- **`darthjee/kerghan`**: the production backend image (NestJS, runs migrations on boot), built
  from `dockerfiles/release_kerghan/Dockerfile`. Render deploys it, and the standalone image
  runs it as an inner service.
- **`darthjee/kerghan-standalone`**: a [Vault](external/vault.md) image
  (`FROM darthjee/vault`) that runs the whole stack in one container: MySQL, the backend, and Tent
  serving the built frontend, on a single port. It comes in an online and an offline variant.
- **`kerghan`**: a thin bash client wrapping the `vault` CLI (`standalone/bin/kerghan`), so a user
  runs all of Kerghan with one command.
- **`install.sh`**: installs the client, and the `vault` CLI when it is missing
  (`standalone/install.sh`).

The goal is one artifact that runs all of Kerghan for self-hosting and local use. Out of the
box, a new installation opens already logged in as an admin: the client writes a
[default user](modules/auth/default-user.md) to `kerghan.env` and turns automatic login on,
published on `127.0.0.1` only (see [`auto-login` and `bind`](standalone/config-files.md#config-format)).

### Why Vault

- **Chosen: a Vault image.** One image, one container, one exposed port. It reuses the compose
  stack and each service's own image unchanged, and the client can wrap the `vault` CLI. Accepted
  costs: it needs Sysbox or `--privileged` (so no Render, no rootless Docker, no Windows),
  Docker-in-Docker adds weight, and the offline variant stores image data twice.
- **Possible later fallback: a released compose bundle.** The inner compose file plus the frontend
  and Tent files as a release asset, run with `docker compose` on the host, with no privileges.
  The compose file inside the standalone image is essentially this bundle.
- **Rejected:** a fat single image (MySQL, Node and Tent under a process supervisor), an external
  database (not standalone), and Helm or Kubernetes manifests (overkill for self-hosting).

Background workers (the in-process `deku-swarm` pool, see [modules/workers.md](modules/workers.md))
run inside the standalone backend with no extra service or variables; the defaults apply.

### Out of scope

Navi (the cache warmer), phpMyAdmin, email (`KERGHAN_EMAILS_ENABLED` stays off), a backup
command, several instances per host, and production use. Production keeps its own deploy (see
[architecture/infra/releases.md](architecture/infra/releases.md)); Render never runs the Vault image. Shell
completion covers bash only; zsh and fish are later Epics (see
[Client completion](standalone/client-completion.md#overview-and-scope)).

## Pages

Everything else lives under `docs/agents/standalone/`. Read the page that matches your task:

| Page | Read this when |
|------|----------------|
| [install.md](standalone/install.md) | You change requirements, the installer, release-asset verification or the upgrade steps. |
| [client.md](standalone/client.md) | You change the `kerghan` client: the `vault` mapping, secrets, `up` or other behavior. |
| [config-files.md](standalone/config-files.md) | You change the `~/.kerghan/` files or the `config` format. |
| [inner-stack.md](standalone/inner-stack.md) | You change what runs inside the container: MySQL, Tent, the frontend, image variants, `OriginGuard` or the effective client IP. |
| [release-and-caveats.md](standalone/release-and-caveats.md) | You change image tags and versioning, or need the known caveats and how the distribution is tested. |
| [client-config.md](standalone/client-config.md) | You change `kerghan configure` or `kerghan wizard`. |
| [client-update.md](standalone/client-update.md) | You change `kerghan update`. |
| [client-completion.md](standalone/client-completion.md) | You change bash completion. |
