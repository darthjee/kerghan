# Issue: Add the kerghan client CLI

## Description

Part of epic #336. Add the `kerghan` client: a thin bash script (`standalone/bin/kerghan`) that
wraps the `vault` CLI to run `darthjee/kerghan-standalone`. It supports Linux and macOS on
bash 3.2+ and depends on `vault`, `docker` and `openssl` on the host. The full contract is in
`docs/agents/specs/standalone/client.md`. This issue implements it, minus the
`~/.kerghan/config` settings (#345).

**Owner:** standalone (`standalone/bin/kerghan`, its tests). The infra agent owns the
docker-compose service, the CircleCI job and the `scripts/bump_version.sh` change.

## Problem

#342 and #343 build and release `darthjee/kerghan-standalone` (online and `-offline`). Running
it still means hand-writing `vault` invocations, generating secrets, choosing the image tag and
setting `FRONTEND_BASE_URL`. There is no supported way to start, stop, upgrade or reset a local
instance.

## Expected Behavior

### Commands

```
kerghan up [--offline] [-p PORT] [-f]   # start (detached by default) on http://localhost:3000
kerghan down                            # stop and remove the container; data is kept
kerghan logs [-f]
kerghan status
kerghan compose <args>                  # e.g. `kerghan compose exec mysql sh`
kerghan reset                           # wipe all data (removes vault-kerghan-data), asks for confirmation
kerghan version | help
```

- `-f` on `up` runs in the foreground. `--offline` selects the offline image variant.
- Unknown commands or flags print usage and exit non-zero.

### Mapping to `vault`

```
vault <cmd> --name kerghan --image darthjee/kerghan-standalone:<version>[-offline] \
  --env-file ~/.kerghan/kerghan.env -p <port>:80
```

- This gives container `vault-kerghan` and data volume `vault-kerghan-data`.
- The port comes from `-p` or the default `3000`. Settings from `~/.kerghan/config` (port,
  runtime, stop timeout, `image-tag`) are #345.
- The online and offline variants share the instance name and the data volume.

### Version pinning

- The script holds `KERGHAN_VERSION="x.y.z"` in the repo. `scripts/bump_version.sh` updates
  it with the `package.json` versions, so CLI `<v>` always runs image `<v>`, and the repo copy
  is always correct. No rewrite happens at release time.
- `kerghan version` prints that version.

### `up` decision logic

1. **Refuse** (non-zero exit, no container created) when `~/.kerghan/kerghan.env` is missing
   but `vault-kerghan-data` exists. The message hints to restore the file or run
   `kerghan reset`.
2. **Secrets:** when `kerghan.env` is missing and no volume exists, create `~/.kerghan/` and
   write `kerghan.env` with mode 600, containing `KERGHAN_SECRET_KEY` and
   `KERGHAN_INTEGRATIONS_KEY` (each `openssl rand -base64 32`). Never regenerate or rewrite it
   when it exists.
3. **`FRONTEND_BASE_URL`:** pass `http://localhost:<port>` (the effective port) unless
   `kerghan.env` sets it. This trusts the origin for `OriginGuard` (Tent rewrites `Host`) and
   gives the base URL for password-reset links and GitHub callbacks (verified in #337).
4. **Compare with the running instance** (its image from `docker inspect vault-kerghan`):
   - Same image (same version and variant) and same port: no-op. Print that Kerghan is already
     running at `http://localhost:<port>` and exit 0.
   - Older version, the other variant (online ↔ offline), or a different port: recreate it
     (`down`, then `up`). The data volume is kept, and migrations run at backend boot.
   - Newer version than the CLI (a downgrade): warn that it is unsupported, and do not recreate
     it silently.
   - No instance: plain `up`.
5. **Port in use:** surface Vault's error with a hint to use `-p <port>`.

### Other commands

- `reset` asks for confirmation (default no). It then stops the instance and removes
  `vault-kerghan-data`, and leaves `kerghan.env` in place. Declining does nothing.
- `status` / `logs` are the way to see a failed migration or an unhealthy service.
- One instance per host: the name `kerghan` is fixed.

### Out of scope

Shell completion, a backup command, a `--name` flag, and `~/.kerghan/config` (#345).

### Acceptance criteria

- `kerghan up` on a clean machine (with `vault` installed) starts Kerghan on
  `http://localhost:3000` with generated secrets. `kerghan down` / `up` keep the data.
- All required tests below pass in CI.

## Solution

- **Script:** `standalone/bin/kerghan`, bash 3.2 compatible (no associative arrays, no
  `${var,,}`, no `mapfile`). Version comparison is plain semver, done in bash.
- **Version bump:** extend `scripts/bump_version.sh` to rewrite the `KERGHAN_VERSION=` line in
  `standalone/bin/kerghan`.
- **Tests:** bats tests with `vault`, `docker` and `openssl` stubbed on `PATH` and a temporary
  `HOME`. They cover:
  - the `vault` arguments built for each command, for both variants and with a custom port;
  - secret generation on the first `up`, and mode 600;
  - no regeneration when `kerghan.env` exists;
  - the refusal when `kerghan.env` is missing but the volume exists;
  - the no-op when the same image is already running;
  - upgrade, variant swap and port change recreating the instance and keeping the volume;
  - the downgrade warning;
  - `reset` confirmation, and a decline doing nothing;
  - the default `FRONTEND_BASE_URL` and its override from `kerghan.env`;
  - usage and a non-zero exit on unknown commands or flags.
- **Test infra:** a `standalone_tests` docker-compose service (a bats image mounting
  `standalone/`), and a CircleCI job that runs it on every build.

## Depends on

#342 (standalone stack) and #343 (release), both merged.

## Benefits

- One command to start, stop, upgrade or reset a local Kerghan instance.
- Secrets are generated safely once and never rotated by accident.
- The CLI and the image versions stay in lockstep, with safe upgrades and an explicit
  downgrade warning.
