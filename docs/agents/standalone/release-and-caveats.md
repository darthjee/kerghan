# Standalone: images, caveats and testing

Part of [Standalone Distribution](../standalone.md). Image tags and versioning, caveats and how the distribution is tested.

## Images and versioning

| Image | Built from | Tags |
|---|---|---|
| `darthjee/kerghan` | `dockerfiles/release_kerghan/Dockerfile` | `<v>`, `latest` |
| `darthjee/kerghan-standalone` | `dockerfiles/kerghan_standalone/Dockerfile`, target `standalone` | `<v>`, `latest` |
| `darthjee/kerghan-standalone` | same file, target `standalone-offline` | `<v>-offline`, `latest-offline` |

- All of them are multi-arch manifests (amd64 and arm64 under one tag), published to Docker Hub on
  every semver git tag.
- `<v>` is the app's git semver tag (for example `0.5.0`), not the `version` file, which only
  tracks the `*-base` images.
- `darthjee/kerghan-standalone:<v>` (both variants) always runs `darthjee/kerghan:<v>`.
- The client pins an exact version; `latest` and `latest-offline` exist for convenience only.

Pinned images:

| Image | Pin | Architectures |
|---|---|---|
| `darthjee/vault` (base) | `0.1.0` | multi-arch manifest |
| `mysql` (inner) | `8.4.11` | multi-arch manifest |
| `mysql-legacy` (inner, migration only) | `9.3.0` | multi-arch manifest |
| `darthjee/tent` (inner) | `1.0.3` (amd64), `1.0.3-arm64` (arm64) | separate tags, selected per architecture |

Changing a pin is a normal change to the Dockerfile or the inner compose file. A Vault pin change
must also update `VAULT_VERSION` in `standalone/install.sh`.

The CI jobs that build and publish the images and the client assets (`release-kerghan`,
`release-kerghan-standalone`, `release-kerghan-assets`) are documented in
[architecture/infra.md](../architecture/infra.md).

## Caveats

- **HTTPS.** The access-token cookie is always `Secure`. Browsers accept it on
  `http://localhost`, but not over plain HTTP on a LAN IP or a hostname, where login silently
  fails. Run standalone on `localhost`, or put your own TLS reverse proxy in front of it (and set
  `FRONTEND_BASE_URL` to the `https` URL in `kerghan.env`). An `https` `FRONTEND_BASE_URL` is also
  required to enable the GitHub OAuth App and GitHub App integration types.
- **Docker Engine before 28.0 on Linux exposes `127.0.0.1` ports to the LAN.** This is a known
  Docker issue ([moby#45610](https://github.com/moby/moby/issues/45610)), fixed in Docker Engine
  28.0: on older engines, hosts on the same LAN segment can reach a port published on
  `127.0.0.1` by routing to the container's address. The default `bind=127.0.0.1` is the guard for
  automatic login, so on Linux use Docker Engine 28.0 or later (check with
  `docker version --format '{{.Server.Version}}'`), or turn automatic login off.
- **Effective client IP only measured on Docker Desktop for macOS.** The
  [Effective client IP](inner-stack.md#effective-client-ip) findings are not verified yet for (tracked in
  [#384](https://github.com/darthjee/kerghan/issues/384)):
  - a Linux host with native Docker, with and without Sysbox;
  - a full end-to-end check with a `kerghan-standalone` image that contains the default-user
    backend (`status.json` reports `admin` from the host browser with the default settings); only
    the network path was measured;
  - Linux with `bind=0.0.0.0`: LAN clients are expected to reach the inner service through DNAT
    with their real, often private, address, which is inside the allowlist. This is why the
    non-loopback warning exists and why `bind` is the real guard;
  - the "not reachable from other interfaces" check of the default bind, repeated on Linux with
    Docker Engine 28 or later (see the Docker Engine caveat above).

  How to run each check: [Verifying the effective client IP](inner-stack.md#verifying-the-effective-client-ip).
- **Back up `~/.kerghan/kerghan.env`.** Losing it logs everyone out and makes the stored
  integration credentials unreadable (they are encrypted with `KERGHAN_INTEGRATIONS_KEY`). Without
  it, `kerghan up` refuses to start until the file is restored or the data is wiped with
  `kerghan reset`.
- **The MySQL password is fixed when the data volume is created.** Setting
  `KERGHAN_MYSQL_PASSWORD` later only applies to a fresh volume (after `kerghan reset`), unless you
  also change it inside MySQL.
- **Disk growth.** Older inner images accumulate in `vault-kerghan-data` after upgrades, and the
  offline variant stores image data twice. There is no automatic pruning; to clean up while the
  instance is running, remove the inner images no container uses:

  ```bash
  docker exec vault-kerghan docker image prune -a -f
  ```

  Unused images of the host Docker (for example older `darthjee/kerghan-standalone` tags) are
  cleaned up as usual with `docker image prune -a` on the host.
- **No running downgrades.** Running an older image against a newer schema is unsupported;
  `kerghan up` refuses it. `kerghan update` can downgrade the client (after a confirmation), but
  never restarts the instance on a downgrade (see [Upgrading](install.md#upgrading)).
- **One instance per host.** The instance name `kerghan` is fixed.
- **Demo user.** The demo-seed migration also creates the `demo` user in standalone databases.
  `KERGHAN_DEMO_PASSWORD` is not passed to the stack, so its password falls back to a non-working
  placeholder. A future epic will handle the demo user in standalone.
- **Failed migration.** A migration that fails during an upgrade keeps the backend from starting;
  it shows up in `kerghan status` and `kerghan logs`. Recovery is to fix forward with the next
  release.

## Testing

| What | How |
|---|---|
| Build the online image locally | `make build-standalone` (tags `darthjee/kerghan-standalone:dev`) |
| Smoke-test it | `make standalone-smoke`, which runs `standalone/scripts/smoke_test.sh`: boots the image with `--privileged`, checks `/health.json` and `/` through Tent, restarts with the data volume kept, and checks no env file or secret is baked in. Needs `--privileged` support on the host Docker. |
| Verify the effective client IP | `standalone/scripts/verify_client_ip.sh [probe\|reach\|e2e]`, run by hand (no `make` target): measures the address the backend sees through Vault, and checks `status.json` against a running instance. See [Verifying the effective client IP](inner-stack.md#verifying-the-effective-client-ip). |
| Client and installer tests | The bats suite in `standalone/test/` (with `helpers/` and command `stubs/`): `docker-compose run --rm standalone_tests`. CI runs it in the `standalone_tests` job. It also covers `configure` and `wizard` (`configure_files.bats`, `configure.bats`, `wizard.bats`, `configure_security.bats`; see the "Required tests" sections of the [Client config](client-config.md) pages), `update` (`update.bats`; see the "Required tests" sections of [Client update](client-update.md)), and bash completion (`completion.bats`, `completion_command.bats`, `completion_safety.bats`, `completion_sync.bats`, `install_completion.bats`; see the "Required tests" sections of [Client completion](client-completion.md)). The whole suite also runs under bash 3.2 (the version macOS ships): `docker-compose run --rm standalone_tests_bash32`, in CI job `standalone_tests_bash32`. |

The release job smoke-tests the published offline image on amd64 with `SKIP_BUILD=true` and
`SMOKE_EXPECT_OFFLINE=true`, which also checks that the stack started from the preloaded tarballs
(see [architecture/infra.md](../architecture/infra.md)). The arm64 image is checked by hand.
