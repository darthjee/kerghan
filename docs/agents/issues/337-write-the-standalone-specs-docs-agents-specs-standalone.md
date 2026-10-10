# Issue: Write the standalone specs (docs/agents/specs/standalone/)

## Description

First step of epic #336 (ship Kerghan as a standalone Vault-based image). Write the feature
specs that every later sub-issue implements against, in `docs/agents/specs/standalone/`,
following the conventions of the specs hub (`docs/agents/specs.md`). These specs are temporary:
the epic's last sub-issues fold their lasting content into the permanent docs and delete the
folder.

The specs own the shared contracts. Later sub-issues follow them and do not redefine them.

## Problem

Epic #336 is implemented by eleven more sub-issues (#338–#348) owned by different agents
(architect, infra, standalone). They share contracts: image names and tags, the env-variable
contract, the CLI and its `~/.kerghan/` layout, the repo layout, and the CI release order.
Without one agreed definition written down first, each sub-issue would make its own decisions
and the pieces would drift apart.

## Expected Behavior

- `docs/agents/specs/standalone/README.md` exists and links every other file in the folder.
- Every decision recorded in #336 is captured, along with the resolved verifications above.
- `docs/agents/specs.md` lists the feature under "Active specs", and no root instruction file
  or agent links directly to `docs/agents/specs/standalone/`.

## Solution

### Folder layout

`docs/agents/specs/standalone/`. The folder is named after the feature, not the tool: the epic
also releases `darthjee/kerghan` and moves Render to it, which is not Vault work.

| File | Content | Read by |
|---|---|---|
| `README.md` | Overview and purpose; the product decision (#336); scope and out-of-scope (no Navi, no phpMyAdmin, no email; the production frontend keeps its SSH deploy); the chosen alternative (Vault) and the rejected ones; the repo layout (`standalone/vault/`, `standalone/bin/kerghan`, `standalone/install.sh`, `standalone/kerghan.env.example`, `dockerfiles/kerghan_standalone/Dockerfile`); a "Known limitations" section (HTTPS: the `Secure` cookie works only on `localhost` over plain HTTP; the demo user exists in standalone databases, with special handling in a future epic); the sub-issue map (#337–#348); an index of the files below | all |
| `images.md` | Image names and tags (`darthjee/kerghan:<app-semver>\|latest`, `darthjee/kerghan-standalone:<v>\|latest` and `:<v>-offline\|latest-offline`, the local-only `darthjee/dev_kerghan`); app-semver versioning (not the `version` file); multi-arch manifests (amd64 and arm64); pinned `mysql`, `darthjee/tent`, `darthjee/vault`; CI release order (`release-kerghan`, then the standalone release and the Render deploy) | #339, #340, #343 |
| `render.md` | Deploying by `imageUrl` with the version tag (never `latest`); rollback; `build-and-release` requiring `release-kerghan`; the manual Render checklist; the answer to whether Render can switch the service in place | #341 |
| `stack.md` | The inner compose stack (`mysql`, `kerghan`, `tent`); healthcheck, `depends_on: service_healthy`, `restart: unless-stopped`; the Tent standalone config and frontend build under `/vault/tent/`, bind-mounted into the stock Tent image, published on Vault port 80; both Dockerfile targets (`standalone`, `standalone-offline`); offline preload (tarballs in `/vault/images/`, `COMPOSE_UP_ARGS="--pull never"`); same-origin and `OriginGuard`; arm64 availability; switching between online and offline; disk growth | #342, #343 |
| `variables.md` | The env contract: required secrets, internal fixed values, the overridable MySQL password (with the "fixed at volume init" caveat), the pass-through allowlist, standalone/Vault-level settings, exclusions | #342, #344, #347 |
| `client.md` | `kerghan` commands and how they map to `vault`; the pinned image version; secret generation; refusing to start when `kerghan.env` is missing but the data volume exists; upgrade (recreate) and downgrade (warn); port in use; a single instance per host; `reset` | #344 |
| `config.md` | The `~/.kerghan/` layout; `config` keys and the flat `key=value` format; precedence (flag, then file, then default); malformed-input handling | #345 |
| `installer.md` | `install.sh` behavior (Docker check, no `sudo`, `~/.local/bin`, `KERGHAN_VERSION` / `KERGHAN_INSTALL_DIR`, installing the pinned Vault CLI when missing); release assets (`kerghan`, `install.sh`, `kerghan.env.example`, `SHA256SUMS`) and how to verify them | #346 |

- **Edge cases are spread out** into the file each one belongs to, rather than a separate
  `edge-cases.md`, so each sub-issue reads only what it needs.
- **Every file ends with a "Required tests" section**, as the hub requires.
- Specs describe decisions, not code.

### Hub integration

Follows the specs hub (`docs/agents/specs.md`).

- **This issue** replaces "none" under **Active specs** with:
  > - **Standalone distribution** — [specs/standalone/](specs/standalone/README.md): ship Kerghan
  >   as `darthjee/kerghan` (Render) and `darthjee/kerghan-standalone` (Vault). Epic #336.
- `AGENTS.md` and `CLAUDE.md` are not changed. Root instruction files link only to the hub.
- **Agents link only to the hub**, too. The `standalone` agent (#338) and `infra` point to the
  "Standalone distribution" entry in `docs/agents/specs.md`, never directly to
  `docs/agents/specs/standalone/`, so deleting the folder never requires touching agent files.
- **At the end of the epic**, #347 folds the lasting content into the permanent docs, and #348
  deletes the folder and moves the entry from "Active specs" to the **Completed specs** table
  (setting "Active specs" back to "none" if nothing else is active):

  | Feature | Now defined in | Product decision |
  |---|---|---|
  | Standalone distribution | `README.md` "Run Kerghan standalone"; `environment-variables.md` "Standalone"; `architecture/infra.md` (release jobs, Render image deploy); `folder-structure.md` | #336 |

- The specs' `README.md` states that the hub's single "last sub-issue" step is split across
  #347 (fold) and #348 (delete and move the entry), so it is not read as a deviation from the
  convention.

### Verifications (resolved while enhancing this issue)

The specs record these answers. They are no longer open questions.

- **arm64 images** (goes in `images.md` and `stack.md`):
  - `darthjee/vault`: every tag is a multi-arch manifest. Pin `darthjee/vault:0.1.0`.
  - `darthjee/tent`: uses separate tags (`1.0.3` is amd64, `1.0.3-arm64` is arm64), not a
    manifest. The standalone Dockerfile uses `TARGETARCH` at build time to write
    `/vault/.env` with `TENT_IMAGE=darthjee/tent:1.0.3[-arm64]`, and the inner compose file
    uses `image: ${TENT_IMAGE}` (compose reads `/vault/.env` automatically; it holds no
    secrets). For the offline variant, CI saves the matching tag. Publishing a multi-arch
    manifest for Tent upstream is an optional follow-up, outside this epic.
  - `mysql:9.3.0` is multi-arch.
- **Render in-place switch** (goes in `render.md`): Render allows changing an existing
  service's source from a Git repo to a prebuilt image (Settings → Build → Source → Existing
  Image). The service id and the `kerghan.onrender.com` hostname stay the same, so there is no
  new service, no copying of environment variables, and no Tent `$backendHost` change. The
  manual checklist is: switch the source to `docker.io/darthjee/kerghan:<tag>`, then let CI
  (or a manual redeploy) deploy it. Image-backed services have no auto-deploy, which matches
  CI triggering every deploy with `imageUrl`. Source:
  https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard
- **`OriginGuard` same-origin** (goes in `stack.md` and `client.md`):
  - Modern browsers send `Sec-Fetch-Site: same-origin`, so writes pass with no configuration.
  - Older browsers without that header fall back to comparing `Origin` with `Host`. Tent
    rewrites `Host` to the backend host (`default_proxy`, by design), so they would be
    rejected. Production has this same limitation today.
  - Decision: the `kerghan` client sets `FRONTEND_BASE_URL=http://localhost:<port>` by
    default (the user can override it in `kerghan.env`). That trusts the origin and also
    provides the base URL for password-reset links and the GitHub callback URLs. Users of
    plain `docker run` set it themselves (documented in `variables.md`).

### Scope boundaries

Specs describe decisions, not code (hub rule).

#### The specs decide (contracts other sub-issues depend on)

- Names: images and tags, the `vault-kerghan` container and `vault-kerghan-data` volume, CLI
  commands and flags, config keys, file paths (`~/.kerghan/…`, `standalone/…`, `/vault/tent/`),
  release asset names.
- The env-variable contract: the variables, their groups, defaults and precedence.
- Behavior anyone can observe: what `kerghan up` does in each state, refusals and their exit
  behavior, upgrade and downgrade rules, the installer's steps and errors.
- The order of CI jobs and what each one publishes.
- The verified facts and the known limitations.
- **Required tests:** *what* must be proven, not how.

#### Left to each sub-issue's plan

- Script structure, function names, argument parsing.
- Dockerfile internals (stages, caching, how the frontend build stage is written).
- The CircleCI multi-arch mechanics (`buildx` vs. `docker manifest`) and executor choices.
- Test tooling (e.g. bats vs. plain shell, the stubs), as long as the required tests are covered.
- Exact message wording, beyond the meaning the specs fix.
- Exact pinned versions, except the verified ones (`darthjee/vault:0.1.0`,
  `darthjee/tent:1.0.3`, `mysql:9.3.0`).

#### Out of scope for this issue

- Any code, Dockerfile or CI change.
- Editing the permanent docs (`README.md`, `environment-variables.md`, …); that is #347. The
  only exception is the hub's "Active specs" entry.
- Re-discussing the decisions made in #336. The specs record them. A later sub-issue that
  needs to change a decision updates the spec in the same PR (hub lifecycle).

### Depends on

Nothing. This is the first sub-issue of #336.

**Owner:** architect

## Benefits

- Every later sub-issue reads only the spec file it needs and builds against settled decisions.
- The verified facts (arm64 tags, Render in-place switch, `OriginGuard` behavior) are recorded
  once instead of being rediscovered.
- Follows the specs hub lifecycle, so folding the specs into permanent docs and deleting them at
  the end of the epic (#347, #348) is mechanical.
