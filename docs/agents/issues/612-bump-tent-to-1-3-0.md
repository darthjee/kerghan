# Bump Tent to 1.3.0

## Problem

Kerghan pins `darthjee/tent` at `1.0.3`. The pin is duplicated across ten places in five code files (plus several docs) and encodes an assumption that no longer holds. There is no single place that says which Tent version Kerghan runs.

The Tent repository changed its publication model. From `1.1.0` onward, `darthjee/tent:<version>` is an OCI image index carrying both `linux/amd64` and `linux/arm64`; `1.3.0` and `latest` currently resolve to the same index digest. The `<version>-arm64` and `latest-arm64` tags belong to the older model: they remain on Docker Hub for historical releases, but no new ones are published and `latest-arm64` no longer moves.

Kerghan still pins the pre-multi-arch era, so it carries machinery that exists only to compensate for a per-architecture tag: a `TARGETARCH` to tag lookup inside the standalone Dockerfile, and a `tent_image_for()` helper inside the release script.

The second half of the problem is ownership. `scripts/bump_version.sh` rewrites every other release pin — README, both `package.json` files, `standalone/bin/kerghan`, `standalone/install.sh` and the thin Render Dockerfile — but it does not know about Tent, and nothing else does either. Bumping Tent is therefore a manual multi-file edit with no guard at all: a bump that misses one occurrence leaves the compose stack and the test images running different Tent versions, and the standalone release saving tarballs for the wrong architecture.

## Current behaviour (reference)

| Location | Behaviour today |

| --- | --- |

| [dockerfiles/kerghan_standalone/Dockerfile](https://github.com/darthjee/kerghan/blob/main/dockerfiles/kerghan_standalone/Dockerfile) | The `standalone` stage declares `ARG TARGETARCH` with no default and a `case` mapping an empty value or `amd64` to `darthjee/tent:1.0.3` and `arm64` to `darthjee/tent:1.0.3-arm64`, then writes `TENT_IMAGE=<tag>` into `/vault/.env`. Any other value fails the build with `Unsupported TARGETARCH`. The `standalone-offline` stage declares its own `ARG TARGETARCH` and copies `standalone/images/${TARGETARCH:-amd64}/` to `/vault/images/`. |

| [bin/release_kerghan_standalone.sh](https://github.com/darthjee/kerghan/blob/main/bin/release_kerghan_standalone.sh) | Sets `TENT_IMAGE=darthjee/tent:1.0.3`. The function `tent_image_for()` returns that value for `amd64` and `$TENT_IMAGE-$arch` for anything else; it is called from `save_images()` when saving `tent.tar`. `save_image()` resolves the multi-arch manifest through `platform_digest`, pulls `repo@digest`, re-tags, verifies `{{.Architecture}}` with `docker image inspect` and then runs `docker save`. |

| [docker-compose.yml](https://github.com/darthjee/kerghan/blob/main/docker-compose.yml) | The `kerghan_proxy` service runs `image: darthjee/tent:1.0.3`. The `proxy_tests` and `proxy_lint` services both run `image: darthjee/tent-test:1.0.3`. |

| [scripts/bump_version.sh](https://github.com/darthjee/kerghan/blob/main/scripts/bump_version.sh) | Rewrites the README version lines, `frontend/package.json`, `backend/package.json`, the `KERGHAN_VERSION` line in `standalone/bin/kerghan` and in `standalone/install.sh`, and the `FROM darthjee/kerghan:<version>` line in `dockerfiles/production_kerghan/Dockerfile`. It contains no Tent or Tent-test reference. |

| [docs/agents/standalone/inner-stack.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/inner-stack.md) | States that `darthjee/tent` "publishes one tag per architecture (`1.0.3` for amd64, `1.0.3-arm64` for arm64), not a manifest", and that the Dockerfile uses `TARGETARCH` to write `/vault/.env`. |

| [docs/agents/standalone/release-and-caveats.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/release-and-caveats.md) | The pinned-images table lists Tent as `1.0.3` (amd64) and `1.0.3-arm64` (arm64), "separate tags, selected per architecture", in contrast with the rows that are described as a multi-arch manifest. |

| [docs/agents/architecture/infra/releases.md](https://github.com/darthjee/kerghan/blob/main/docs/agents/architecture/infra/releases.md) | Describes the standalone release saving "the Tent image (`darthjee/tent:1.0.3` for amd64, `darthjee/tent:1.0.3-arm64` for arm64)". |

| [standalone/vault/docker-compose.yml](https://github.com/darthjee/kerghan/blob/main/standalone/vault/docker-compose.yml) | The header comment documents `TENT_IMAGE` as "darthjee/tent tag matching the image's architecture". The `tent` service consumes `image: ${TENT_IMAGE}`. |

## Proposal

Root `version` file — the single source of truth, next to the existing `*-base` pins:

```
kerghan-base=0.1.2
circleci_kerghan-base=0.1.2
production_kerghan-base=0.1.2
vite_kerghan-base=0.1.2
tent=1.3.0
```

Dockerfile, `standalone` stage — one tag, no architecture lookup, version read from `version` through a BuildKit bind mount (BuildKit is already required), so the file never lands in the image or a layer and a plain `docker build` needs no `--build-arg`:

```
ARG KERGHAN_VERSION=latest

RUN --mount=type=bind,source=version,target=/tmp/version \
    tent_version=$(grep '^tent=' /tmp/version | cut -d= -f2) && \
    [ -n "$tent_version" ] || { echo "version file has no tent= entry" >&2; exit 1; } && \
    printf 'TENT_IMAGE=%s\nKERGHAN_VERSION=%s\nLOGS_IMAGE=%s\n' \
      "darthjee/tent:${tent_version}" "$KERGHAN_VERSION" \
      "docker:27.5.1-cli" > /vault/.env
```

Release script — read from `version` instead of the per-architecture helper, with the same lookup as `bin/image.sh`'s `image_version`:

```
TENT_VERSION=$(grep '^tent=' version | sed -e 's/^tent=//')
TENT_IMAGE="darthjee/tent:$TENT_VERSION"
```

Release script — the guard, reusing the existing `platform_digest`:

```
# Fails unless <image> publishes a linux/<arch> manifest.
function require_platform_manifest() {
  local arch=$1
  local image=$2
  local digests

  digests=$(platform_digest "$arch" "$image" | grep -E '^sha256:[0-9a-f]{64}$' || true)

  if [ -z "$digests" ]; then
    echo "$image has no linux/$arch manifest;" \
      "Tent must be published as a multi-arch tag." >&2
    exit 1
  fi
}
```

New script `scripts/bump_tent.sh` — the Tent pin owner, modelled on `scripts/bump_version.sh`:

```
#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/bump_tent.sh <version>   write tent=<version> to `version`, then sync every copy
#        scripts/bump_tent.sh --check     exit non-zero, listing each copy that differs from `version`
```

### Semantics

1. One Tent tag. `TENT_IMAGE` becomes a constant string `darthjee/tent:<version>` written into `/vault/.env`. The `case` branches and the `Unsupported TARGETARCH` error are removed from the `standalone` stage.
2. `ARG TARGETARCH` is removed from the `standalone` stage only. The `standalone-offline` stage keeps its own `ARG TARGETARCH`, because `COPY standalone/images/${TARGETARCH:-amd64}/` still selects the per-architecture tarball directory.
3. `tent_image_for()` is deleted. `save_images()` calls `save_image "$arch" "$TENT_IMAGE" tent` for both architectures, so `tent.tar` is produced from the same tag twice, once per `linux/<arch>` digest.
4. The guard runs inside the per-architecture loop of `save_images()`, before `save_image` for Tent. It fails the release when the pinned Tent tag has no `linux/<arch>` manifest for the architecture being saved, so a regression to a single-architecture tag fails fast rather than at the architecture check inside `save_image` or, worse, at container start on a user machine.
5. The root `version` file's `tent=X.Y.Z` line is the single source of truth for both `darthjee/tent` and `darthjee/tent-test`. Consumers that can read a file read it directly (release script, standalone Dockerfile, `.claude/scripts/check_proxy.sh`). Consumers that cannot (CircleCI executor `image:` values are static; compose could only interpolate from the gitignored `.env`; docs are plain text) hold synced copies.
6. `scripts/bump_tent.sh <version>` writes `tent=<version>` to `version`, then rewrites every synced copy in an explicit list of files (see [Scope](#scope)), matching one pattern: `darthjee/tent(-test)?:X.Y.Z`. `scripts/bump_tent.sh --check` rewrites nothing and exits non-zero, listing each copy whose version differs from `version`. The script validates the version argument as `X.Y.Z` and fails on an empty argument, mirroring `scripts/bump_version.sh`.
7. The existing `scripts_tests` CircleCI job (`bats/bats:1.11.0`, every push, required by `build-and-release`), which already runs `bats scripts/test`, gains a `scripts/bump_tent.sh --check` step. A hand edit to a copy that bypasses the script therefore fails CI.
8. `darthjee/tent` and `darthjee/tent-test` move in lockstep. They are two image families published from the Tent repository with the same version number; a bump of only one leaves the proxy running one Tent version and its tests another.
9. `scripts/bump_version.sh` is not modified. Tent is a foreign pin (an external project's release cycle), unlike the Kerghan self-version it currently owns, so it gets its own script rather than a new responsibility inside the existing one.

## Scope

### Source of truth

`version` — `tent=X.Y.Z` (new line).

### Read `version` directly — no copy

| File | How |
| --- | --- |
| `bin/release_kerghan_standalone.sh` | `TENT_VERSION` looked up from `version` at file scope (same lookup as `bin/image.sh`) |
| `dockerfiles/kerghan_standalone/Dockerfile` | `RUN --mount=type=bind,source=version,...` in the `standalone` stage; fails the build if `tent=` is missing |
| `.claude/scripts/check_proxy.sh` | Reads `version` to build its `darthjee/tent:<version>` image reference (currently hard-coded and stale at `0.10.1`) |

### Synced copies — rewritten by `bump_tent.sh`, verified by `bump_tent.sh --check` (7 code pins)

| File | Pins |
| --- | --- |
| `docker-compose.yml` | 3 — `darthjee/tent:` (`kerghan_proxy`), `darthjee/tent-test:` (`proxy_tests`, `proxy_lint`) |
| `.circleci/config.yml` | 4 — `darthjee/tent-test:` (`proxy_extension_tests`), `darthjee/tent:` (`upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`) |

### Synced copies — documentation pins

| File | Pins |
| --- | --- |
| `docs/agents/architecture/infra/ci-jobs.md` | 4 |
| `.claude/agents/proxy.md` | 3 (currently stale at `0.10.x`) |
| `.claude/agents/infra.md` | 2 (currently stale at `0.10.x`) |

### Updated by hand in this PR, not by the script

- `docs/agents/architecture/security.md:67` — its `darthjee/tent:1.0.3` reference carries a "recheck on a Tent upgrade" note; it moves to `1.3.0` only after the recheck is done, and every future Tent bump updates it by hand for the same reason.
- One-time prose rewrites from the per-architecture-tag model to a single multi-arch tag: `docs/agents/standalone/inner-stack.md`, `docs/agents/standalone/release-and-caveats.md`, `docs/agents/architecture/infra/releases.md`, and the header comment of `standalone/vault/docker-compose.yml`. If any version string survives in these after the rewrite, that file is added to the script's list.
- `scripts/test/release_kerghan_standalone.bats` — the `darthjee/tent:1.0.3-arm64` fixture becomes a neutral value (see Edge cases).
- `standalone/scripts/smoke_test.sh` — the tightened `TENT_IMAGE` assertion (see Edge cases).

### Delivery

One issue, one PR. Splitting tooling (single source of truth, `bump_tent.sh`, CI job) from the 1.3.0 bump was considered and rejected in favour of a single change; the PR description groups its review notes by the parts below so reviewers can take them in order:

1. Tent version tooling — `version`, direct readers, `bump_tent.sh` / `--check`, the `--check` step in the `scripts_tests` CI job.
2. The bump to 1.3.0 — `scripts/bump_tent.sh 1.3.0` across all synced copies.
3. Multi-arch simplification — Dockerfile `case` and `tent_image_for()` removed, release guard added.
4. [Security recheck](#security-recheck) — verdicts and the row-3 proxy test.
5. [Backward compatibility](#backward-compatibility) — production pre-merge checks.
6. Prose documentation rewrites.

### Out of scope

- `docs/agents/external/tent/*.md` — uses `darthjee/tent:latest`, mirrors upstream docs.
- The root `version` file and the `*-base` images.
- `LOGS_IMAGE` (`docker:27.5.1-cli`).
- An arm64 smoke test in CI.
- Cleaning up previously pulled `1.0.3` / `1.0.3-arm64` images on user hosts.
- Any change to `scripts/bump_version.sh`.
- Upgrading the deploy host's PHP, should the host-PHP pre-merge check fail — it blocks this bump and is tracked as a separate host task.
- Fixing a defect in Tent itself found during the recheck — reported upstream to `darthjee/tent`, and the bump waits for a fixed release; only a small extension-side workaround is in scope.
- Moving other external images (`mysql`, `docker:27.5.1-cli`) into `version`, and digest pinning (#615).
- Refreshing `docs/agents/external/tent/*` against Tent 1.3.0's documentation.
- Automating security-recheck rows 1, 2, 4 and 5.

## Security recheck

The bump moves dev, production (through CircleCI) and standalone onto Tent 1.3.0 at once. Kerghan's security model depends on five Tent behaviours; each must be re-verified against `darthjee/tent:1.3.0` in this PR.

| # | Tent behaviour relied on | Depends on it | Failure if it changed |
| --- | --- | --- | --- |
| 1 | `default_proxy` / `ProxyRequestHandler` forwards incoming request headers (`getallheaders()` into its curl executor), including `Origin` and `Sec-Fetch-Site` | `OriginGuard` (CSRF and login CSRF) | Fails closed (403 on legitimate requests) or open if a header is rewritten |
| 2 | The client's `Host` is moved to `X-Forwarded-Host` and `Host` is set to the upstream host | `OriginGuard`'s `Origin`-equals-`Host` fallback stays fail-closed behind Tent | If `Host` were forwarded unchanged, the fallback starts admitting requests — a security-model change |
| 3 | Kerghan's `SetClientIpMiddleware` overwrites `X-Forwarded-For` with `REMOTE_ADDR`, and nothing later in Tent's chain appends to it | Standalone automatic login through the IP allowlist, with `KERGHAN_TRUSTED_PROXY_HOPS=1` | A client-supplied or Tent-appended entry would let a client spoof its IP — **authentication bypass; highest risk** |
| 4 | Every 2xx `*.json` response is cached by path and query string unless it carries the `skip_cache_header` (`X-Skip-Cache`) | Keeping `user-scoped` / `never` responses out of the shared cache | A renamed or ignored option serves one user's data to another |
| 5 | `Set-Cookie` passes through unchanged and is never stored in or replayed from the cache | The `refresh_token` cookie (`HttpOnly`, `SameSite=Strict`, `Path=/auth`) | Broken sessions, or a cookie replayed to other users |

Out of this recheck (already accepted or out of scope in `docs/agents/architecture/security.md`): `CacheCleanupMiddleware` churn from forged mutating requests, and Tent's `Server` / `X-Powered-By` headers.

### Procedure (required in this PR)

1. **Code review** — review Tent's changes from `1.0.3` to `1.3.0` (changelog, plus the source of `ProxyRequestHandler`, the default middleware chain and its ordering, the cache layer's `skip_cache_header` handling, and response-header handling). Record a pass/fail verdict per row in the PR description.
2. **Live check** against the dev stack on 1.3.0, run once by hand:
   - a request with a forged `X-Forwarded-For` — the backend sees only the socket address (row 3);
   - a cross-site `POST` to a `*.json` route — `403` (rows 1, 2);
   - a `user-scoped` endpoint requested as two different users — neither receives the other's response (row 4);
   - `login.json` — `Set-Cookie` arrives with its attributes intact and is not replayed on a later request (row 5).
3. **Automated regression test for row 3** — a PHPUnit test under `proxy/extension/tests/proxy`, running in `proxy_tests` / `proxy_extension_tests` against `darthjee/tent-test`, that drives a request carrying a client-supplied `X-Forwarded-For` through the full handler chain and asserts the forwarded header holds exactly one entry, `REMOTE_ADDR`. The existing `SetClientIpMiddlewareTest` covers only the middleware in isolation. Rows 1, 2, 4 and 5 stay manual.
4. **Docs** — update `docs/agents/architecture/security.md:67` to "verified in `darthjee/tent:1.3.0`", and widen that note to name the client-IP (row 3) and cache-key / `skip_cache_header` (row 4) assumptions too, so future bumps recheck all five.
5. **A failing row is fixed in this PR**, under the same rule as a proxy-extension break.

## Backward compatibility

The bump reaches three deployments. Production carries the real risk; standalone and dev are compatible by construction.

### Production (SSH deploy host, through CircleCI) — required pre-merge checks

Recorded in the PR description next to the [Security recheck](#security-recheck) verdicts. A failing check blocks the merge.

1. **Host PHP version.** `upload_proxy_files` rsyncs Tent's PHP source (`/var/www/html/`) to the host, where the **host's own PHP** executes it — the image's PHP is irrelevant in production. Compare Tent 1.3.0's minimum PHP version (`composer.json` / its Dockerfile) with the host's PHP and record both. If the host is too old, the bump is blocked until the host is upgraded, and the PR says so.
2. **Image layout and tooling.** The deploy jobs (`upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`) run *inside* `darthjee/tent:<version>` and need `bash`, `ssh`, `rsync`, and the full runtime tree (including `vendor/`) at `/var/www/html/`; `proxy_extension_tests` copies into `/var/www/html/extension/`. Confirm `darthjee/tent:1.3.0` and `darthjee/tent-test:1.3.0` still provide them — a slimmed image or a moved tree would fail a tag build or, worse, upload the wrong tree.
3. **Host-only state.** `copy_proxy_configuration` restores `locals.php` (real secrets) and `.htaccess` from the host. Confirm `proxy/prod_configuration`'s rule format and the variables `locals.php` provides (e.g. `$cacheFolder`) remain valid under 1.3.0 with no change to production secrets. If 1.3.0 requires a new `locals.php` key, that is a manual host step the PR must state explicitly.

### Production — documented expectations

4. **Cache on disk.** The prod `$cacheFolder = './cache'` sits inside the swapped release directory, and `run_release` deletes the old one, so 1.3.0 starts with an empty cache and never reads 1.0.3-format entries. The PR confirms the host's real `locals.php` does not point the cache outside the release directory.
5. **Rollback.** `run_release` removes the previous release directory, so there is no on-host swap back. Rollback is re-running the previous tag's pipeline, whose CircleCI pins are still `1.0.3`.

### Standalone users — compatible

6. Tent's configuration, static files and extension are baked into the image and mounted read-only (`/vault/tent/...`), so they always match the Tent version in the same image. Tent keeps no cache across restarts in the inner stack, so there is no state to migrate. Downgrading to an older `kerghan-standalone` tag brings back `1.0.3` / `1.0.3-arm64`, which Tent keeps on Docker Hub. `standalone/bin/kerghan` does not reference the Tent image; only `/vault/.env` inside the image does.

### Dev stack — low risk

7. Developers pull the new images on their next `docker-compose` run. `proxy/dev_configuration` falls under the same "if 1.3.0 breaks the proxy, fix it in this PR" rule, exercised by the manual end-to-end check.

### Unchanged interfaces

The `/vault/.env` key set (`TENT_IMAGE`, `KERGHAN_VERSION`, `LOGS_IMAGE`, enforced by `smoke_test.sh`), the `kerghan` CLI flags and config, and the existing `-arm64` tags on Docker Hub.

## Expected

- `dockerfiles/kerghan_standalone/Dockerfile` contains no `case` statement over `TARGETARCH` and no `Unsupported TARGETARCH` message.
- The `standalone` stage of that Dockerfile declares no `ARG TARGETARCH`; the `standalone-offline` stage still does.
- `bin/release_kerghan_standalone.sh` defines a single `TENT_IMAGE` (`darthjee/tent:<version from version file>`) and no `tent_image_for` function.
- A release build fails, with an explicit message naming the image and the architecture, when the pinned Tent tag lacks a `linux/<arch>` manifest.
- `docker-compose.yml` pins `darthjee/tent:1.3.0` for `kerghan_proxy` and `darthjee/tent-test:1.3.0` for `proxy_tests` and `proxy_lint`.
- `scripts/bump_tent.sh 1.3.0` leaves the repository unchanged (idempotent when already at that version) and `scripts/bump_tent.sh 1.4.0` updates `version` and every synced copy listed under [Scope](#scope) in one run, leaving `docs/agents/architecture/security.md` untouched.
- `bin/release_kerghan_standalone.sh` and `dockerfiles/kerghan_standalone/Dockerfile` contain no literal Tent version; both derive it from `version`.
- `scripts/bump_tent.sh --check` exits zero on a consistent tree and non-zero, naming the file, when any synced copy differs from `version`; the `scripts_tests` CircleCI job runs it on every push.
- `docker-compose run --rm proxy_tests` and `docker-compose run --rm proxy_lint` pass against `darthjee/tent-test:1.3.0`.
- No documentation under `docs/agents/` describes Tent as publishing one tag per architecture.
- The PR description records a pass verdict for each of the five rows in [Security recheck](#security-recheck), and `docs/agents/architecture/security.md` names `darthjee/tent:1.3.0` as the verified version and lists all five assumptions.
- The PR description records the three production pre-merge checks in [Backward compatibility](#backward-compatibility) (host PHP vs Tent 1.3.0 minimum, image layout and tooling, `prod_configuration` / `locals.php` validity), all passing, plus the rollback path.
- A proxy test asserts that, through the full Tent 1.3.0 handler chain, a client-supplied `X-Forwarded-For` is replaced by a single `REMOTE_ADDR` entry.
- The standalone image built from this branch produces a `/vault/.env` whose `TENT_IMAGE` line reads `darthjee/tent:1.3.0` on both `linux/amd64` and `linux/arm64`.

## Design decisions

| Decision | Choice | Rationale |

| --- | --- | --- |

| Which pins move | All of them: `version` (source), its direct readers, and every synced copy listed under [Scope](#scope) | A partial bump is the exact failure mode this issue exists to prevent; the proxy and its tests would disagree on the Tent version. |

| The `TARGETARCH` case | Removed; `TENT_IMAGE` becomes a constant | The case existed only to translate a multi-arch-aware build platform into a per-architecture tag. With a real multi-arch tag the lookup has no input to transform. |

| `ARG TARGETARCH` scope | Removed from `standalone`, kept in `standalone-offline` | The offline stage still selects a per-architecture tarball directory through `${TARGETARCH:-amd64}`. |

| Regression protection | Explicit guard in the release script, failing when the tag lacks the target architecture's manifest | Turns a silent, architecture-specific runtime break into a release-time error that names the image and architecture. |

| Tent pin ownership | New `scripts/bump_tent.sh`, `scripts/bump_version.sh` untouched | Tent's version belongs to another project's release cycle; folding it into the self-version script would conflate two independent cadences. |

| Single source of truth for the Tent version | `tent=X.Y.Z` in the root `version` file; direct readers where possible, synced copies plus a CI drift check elsewhere | `version` already holds `name=value` image pins read by `bin/image.sh` / `bin/release_kerghan.sh`. CircleCI executors, compose (whose only interpolation source, `.env`, is gitignored) and docs cannot read a file, so they stay as copies — but `bump_tent.sh --check` in CI makes drift impossible to merge. |
| Dockerfile reads `version` how | BuildKit bind mount in the `standalone` stage | Plain `docker build` (incl. `smoke_test.sh`) keeps working with no `--build-arg`, no stale default exists, and the file never lands in a layer. Rejected: a required `ARG TENT_VERSION` passed by every caller. |
| Renovate / Dependabot instead of `bump_tent.sh` | Rejected | Dependabot does not manage CircleCI executors; Renovate needs custom regex managers for doc pins and an external bot. Neither runs the [Security recheck](#security-recheck) a Tent bump now requires. |
| Keep per-architecture tags and `tent_image_for()` | Rejected | No `1.3.0-arm64` tag exists. |
| Pin `darthjee/tent:latest` | Rejected | Unreviewed Tent upgrades would reach production with no security recheck. |
| Multi-arch guard in `bump_tent.sh` as well | Rejected | Tags are mutable, so only the release-time check is authoritative; a bump-time check would also make the script need Docker. |
| Pin by digest (`darthjee/tent:1.3.0@sha256:<index>`) | Deferred to #615 | Would guarantee the rechecked bytes are what ships, but no other image in the repository is digest-pinned; it belongs in a separate issue covering every external image. |
| Drift enforcement | `bump_tent.sh --check` as a new step of the existing `scripts_tests` CircleCI job (every push) | A source of truth with unchecked copies is a convention, not a guarantee. |

| Tent-test | Bumped in the same change and by the same script | Same repository, same release number, and the test images gate the proxy extension. |

| If Tent 1.3.0 breaks the proxy extension | Fixed in the same PR | The extension subclasses `Tent\Middlewares` and `Tent\Cache`; shipping the bump without a green proxy suite would ship a broken proxy. |

| Documentation scope | Doc pins rewritten by `bump_tent.sh`, except `security.md` | The stale `0.10.x` pins in `.claude/` prove hand-maintained doc pins drift; `bump_version.sh` already rewrites the README, so docs in the script is the existing precedent. `security.md` is excluded because its "recheck on a Tent upgrade" line must only move after a human recheck. |
| CI changes | Tent pins only; no new CI jobs | The arm64 smoke test stays manual, as it is today; this issue does not change the release pipeline's architecture coverage. |

### Edge cases (pinned)

- An empty or malformed version argument to `scripts/bump_tent.sh` exits non-zero with a format error, before touching any file.
- Running `scripts/bump_tent.sh` with the version already pinned rewrites the same bytes and exits zero; it is idempotent, not an error.
- A `version` file with no `tent=` line fails the standalone build (explicit message from the `RUN` step), the release script (empty `TENT_VERSION` rejected before any pull), and `bump_tent.sh --check`.
- A synced copy edited by hand to a different version (e.g. compose bumped without the script) fails `bump_tent.sh --check` and therefore the `scripts_tests` CI job, naming the file.
- A Tent tag that exists but carries only one platform fails the release with the explicit guard message, before any build is pushed.
- A Tent tag that does not exist at all fails inside `platform_digest` with the existing inspect error, not with the guard message; the two failures stay distinguishable.
- The legacy `standalone/images/<arch>/tent.tar` produced by a previous release is not migrated or reused; `save_images()` clears the architecture directory first, as it already does.
- A local `docker build` without BuildKit leaves `TARGETARCH` unset in `standalone-offline`, and `${TARGETARCH:-amd64}` keeps it on the amd64 tarballs. This behaviour is unchanged.
- The `logs` service keeps `LOGS_IMAGE=docker:27.5.1-cli`; Tent's bump does not touch it.
- **Production ships the bump too.** `upload_proxy_files` in `.circleci/config.yml` copies `/var/www/html/` out of its `darthjee/tent:<version>` job image to the SSH deploy host, so the CI pins decide the production Tent runtime. All CircleCI Tent pins (`proxy_extension_tests` on `darthjee/tent-test`, and `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension` on `darthjee/tent`) move in lockstep, so the extension deployed to production is the one tested against the same Tent version. A Tent bump therefore reaches the live proxy on the next tag release; this is intended and must be stated in the PR.
- **`bump_tent.sh` rewrites only versioned release pins.** It edits an explicit list of files (not a repository-wide search) and matches only `darthjee/tent(-test)?:X.Y.Z` followed by end of line or whitespace. `darthjee/tent:latest` in `docs/agents/external/tent/*.md` is never touched.
- **Test fixtures do not carry a real Tent pin.** `scripts/test/release_kerghan_standalone.bats` currently uses `darthjee/tent:1.0.3-arm64` as a `save_image` argument; it is changed to a neutral value (e.g. `darthjee/tent:9.9.9`) so it is neither a stale `-arm64` reference nor rewritten by `bump_tent.sh`.
- **Existing standalone installs need no migration.** `/vault/.env` is baked into the image, so a new image carries `TENT_IMAGE=darthjee/tent:1.3.0`: online images pull it on next boot, offline images load the new `tent.tar`. The previously pulled `1.0.3` / `1.0.3-arm64` images remain in the host's Docker storage; cleaning them up is out of scope.
- **Both architectures' tarballs share one tag.** `save_image` pulls `repo@digest` per architecture and re-tags it as `darthjee/tent:1.3.0`, so `amd64/tent.tar` and `arm64/tent.tar` hold the same tag name with different digests. Separate directories keep them apart; the existing `{{.Architecture}}` check in `save_image` stays unchanged and is now the last line of defence against a wrong-architecture tarball.
- **The smoke test checks the exact tag shape.** `standalone/scripts/smoke_test.sh` tightens its `/vault/.env` assertion from the `^TENT_IMAGE=darthjee/tent:` prefix to `^TENT_IMAGE=darthjee/tent:[0-9]+\.[0-9]+\.[0-9]+$`, so a leftover `-arm64` suffix fails it.
- **Downgrades are accepted.** `scripts/bump_tent.sh` performs no version-order check (e.g. `1.2.0` while on `1.3.0` succeeds), mirroring `scripts/bump_version.sh`.

## Implementation notes

- `docker-compose.yml` holds three Tent references with two different repository names. A naive `s|darthjee/tent:[0-9.]*|...|` substitution on `darthjee/tent-test:1.0.3` produces `darthjee/tent-test` only if the pattern is written to tolerate the `-test` suffix; anchor the pattern at the tag, not at the repository name.
- `bin/release_kerghan_standalone.sh` keeps `TENT_VERSION` / `TENT_IMAGE` at file scope near `MYSQL_IMAGE`, `MYSQL_LEGACY_IMAGE` and `LOGS_IMAGE`, now derived from `version` rather than literal; the script already runs from the repository root, as `bin/release_kerghan.sh` does when it reads `version`.
- The `scripts_tests` job (Alpine `bats/bats:1.11.0` plus `git openssh-client jq`) has BusyBox `sed`, so `bump_tent.sh` must not use BSD-only `sed -i ''` (as `scripts/bump_vault.sh` / `bump_version.sh` do): write to a temp file and `mv`, so the script runs on macOS and in its own bats suite. `scripts/bump_vault.sh` (its `V` regex and `replace` helper) is the closer model for the script's shape.
- `platform_digest` already ignores the `variant` field, so `arm64/v8` matches and attestation entries with `unknown/unknown` never do. The guard inherits that behaviour for free.
- Removing `tent_image_for()` orphans nothing else: it has exactly one caller, inside `save_images()`.
- `proxy/extension/lib/` holds classes that extend Tent's `Tent\Middlewares` and `Tent\Cache` namespaces and are wired through `proxy/extension/loader.php`. Moving `tent-test` from `1.0.3` to `1.3.0` is a three-version jump against those interfaces; the proxy suite is the detector, and a failure is in scope for this PR.
- The `standalone` image's `KERGHAN_VERSION` build argument is unrelated to this change and keeps its `latest` default.
- `.circleci/config.yml` holds four Tent pins (`proxy_extension_tests`, `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`) that move with this bump (see Edge cases). The `release-kerghan-standalone` job itself needs no edit: it calls the release script, and the script now carries the guard.

## Testing

- `scripts/test/bump_tent.bats` — new bats suite for `scripts/bump_tent.sh`, alongside the existing `scripts/test/release_kerghan_standalone.bats`. Cover: writing `tent=` in `version` and rewriting every synced copy (both `tent` and `tent-test`); `--check` passing on a consistent tree and failing, naming the file, on a drifted copy and on a missing `tent=` line; leaving `darthjee/tent:latest`, suffixed tags such as `darthjee/tent:9.9.9-arm64`, and `docs/agents/architecture/security.md` untouched (pattern anchored on `X.Y.Z` followed by end of line or whitespace); refusing an empty argument; refusing a malformed version; idempotency when the version is already pinned. Reuse the existing command stubs and helpers under `scripts/test/`, in particular `scripts/test/helpers/setup.bash`.
- `proxy_extension_tests` — unchanged in content, now running against `darthjee/tent-test:1.3.0` through the `proxy_tests` service. A failure here blocks the bump rather than being deferred to a follow-up issue.
- Row-3 regression test — new PHPUnit test under `proxy/extension/tests/proxy` (see [Security recheck](#security-recheck), step 3).
- Manual security live check — the four requests in [Security recheck](#security-recheck), step 2.
- `proxy_lint` — PHPCS over `proxy/extension/lib`, `proxy/extension/tests`, `proxy/dev_configuration` and `proxy/prod_configuration`, now against `darthjee/tent-test:1.3.0`, since the ruleset resolves Tent's own sources from that image.
- `scripts/test/release_kerghan_standalone.bats` — extend with a case asserting that `require_platform_manifest` aborts when `platform_digest` returns nothing, using a `docker` stub. The guard is the only new failure path in the release script. Also: replace the `darthjee/tent:1.0.3-arm64` fixture with a neutral value (e.g. `darthjee/tent:9.9.9`), and assert that `TENT_IMAGE` is derived from `version`'s `tent=` line and that an empty value aborts before any pull.
- `scripts_tests` CircleCI job — already runs `bats scripts/test` (so the new suites run with no wiring); gains a `scripts/bump_tent.sh --check` step.
- `standalone/scripts/smoke_test.sh` — its `/vault/.env` assertion is tightened to `^TENT_IMAGE=darthjee/tent:[0-9]+\.[0-9]+\.[0-9]+$`. Running the full standalone smoke test is not required by this issue, but a local `docker build --target standalone` must confirm the bind-mounted `version` produces that line, and that removing `tent=` from `version` fails the build with the explicit message.
- Manual end-to-end verification, per the scope agreed for this issue: `docker-compose run kerghan_proxy` brings the stack up through Tent 1.3.0, and a request to a `*.json` route reaches the backend. The standalone image's smoke test is not part of this issue.

## Context

Origin: issue #612 in `darthjee/kerghan`, opened by `darthjee`, body in full: "We need to bump tent verson, specially in the standalone image, to 1.3.0". Labels: `Feature`, `shipit`, `Writting`. No comments on the issue.

Affected areas: the standalone distribution (`dockerfiles/kerghan_standalone/`, `bin/release_kerghan_standalone.sh`, `standalone/vault/`), the dev compose stack (`docker-compose.yml`), the release tooling (`scripts/`), and the Tent side of the proxy extension (`proxy/extension/`, exercised through `proxy_tests` and `proxy_lint`).

Reference documents: [Standalone Distribution](https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone.md), [Inner Stack](https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/inner-stack.md), [Standalone release and caveats](https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/release-and-caveats.md), [Infra — Releases](https://github.com/darthjee/kerghan/blob/main/docs/agents/architecture/infra/releases.md), [Architecture — Proxy](https://github.com/darthjee/kerghan/blob/main/docs/agents/architecture/proxy.md), and the `standalone` specialist agent definition in [.claude/agents/standalone.md](https://github.com/darthjee/kerghan/blob/main/.claude/agents/standalone.md).

External reference: the Tent repository's own publication documentation, `DOCKERHUB_DESCRIPTION.md` in `darthjee/tent`, states that images "are published as a single multi-arch tag for `linux/amd64` and `linux/arm64`" and that "No new `-arm64` / `latest-arm64` tags are published".
