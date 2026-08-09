# Issue: Deploy frontend

## Description

Add a CircleCI release chain that runs on semver tag pushes (`\d+\.\d+\.\d+`): building and
deploying the frontend, deploying the Tent proxy (runtime, configuration, and rules), and
deploying the backend to Render — atomically, so all three always land together.

## Problem

`.circleci/config.yml` currently only runs tests/lint (`backend_tests`, `backend_checks`,
`jasmine`, `frontend-checks`, `proxy_extension_tests`) plus base-image publishing
(`release-image`). There is no deploy/release chain wired up at all, even though the scripts it
would need already exist in the repo and go completely unused:

- `bin/deploy_frontend.sh` — build/upload/link/release primitives over SSH, including the
  workflow-scoped temp-dir mechanism and the atomic `mv`-based swap.
- `scripts/deploy.sh` / `scripts/render.sh` — Render backend deploy (branch update, trigger,
  watch-until-live), added in commit `00c5b28` but never called from CI.

Several comments across the repo (`.circleci/config.yml` lines 51-52/86/133,
`.claude/agents/infra.md` line 45, `docs/agents/environment-variables.md` §4) point to a "full
release chain" supposedly living in `.circleci/config.yml.bkp` / `aux/todo.md` /
`aux/circleci_config.yml` / `aux/base-image.md`. None of these paths have ever existed in this
repo's committed history (confirmed via `git log --all`). They referred to `aux/`, a local,
uncommitted scratch-guide folder from an earlier planning pass, living at a *different* local
checkout (`/Users/darthjee/projetos/mine/kerghan/aux/`) and slated for deletion — so those
references need to be replaced with real content or reworded, not left dangling.

Separately, no real Render service, SSH deploy host, or production domain exists yet for
Kerghan (only `KERGHAN_PRODUCTION_URL=http://localhost:3000` in `.env.dev.sample`) —
provisioning that is explicitly not part of this issue (see Solution § Infrastructure).

## Expected Behavior

On a semver tag push, after the existing test/lint jobs pass:

- The frontend is built (Vite) and uploaded to the SSH deploy host.
- The Tent proxy runtime, its production configuration, and its extension are uploaded to the
  same host.
- The backend is deployed to Render: the service's branch is pointed at the tag, a deploy is
  triggered, and it's watched until `live`.
- Only once **all** of the above succeed — including the backend reaching `live` — does the
  atomic swap (`bin/deploy_frontend.sh release`) make the new frontend/proxy build live, so
  frontend, proxy, and backend never go live out of sync with each other.
- If anything fails along the way, the swap simply never runs and the previously-live
  frontend/proxy/backend keep serving unchanged.
- Cache warm-up (Navi) is explicitly **not** part of this: `warm-up-cache`/`wake-navi` stay out
  of scope, to be wired in a future issue.

## Solution

### Job graph

Wired into `.circleci/config.yml`, gated by the existing `\d+\.\d+\.\d+` tag filter
(`*tags_only` below = `tags: {only: /\d+\.\d+\.\d+/}, branches: {ignore: /.*/}`):

```
build-and-release        requires: [backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]
upload_proxy_files       requires: [backend_tests, backend_checks, jasmine, frontend-checks, proxy_extension_tests]
upload_fe_files          requires: [<same test/check jobs>, release-vite_kerghan-base, release-vite_kerghan-base-arm64]
upload_extension         requires: [upload_proxy_files]
copy_proxy_configuration requires: [upload_proxy_files]
release                  requires: [build-and-release, upload_extension, upload_proxy_files,
                                     copy_proxy_configuration, upload_fe_files,
                                     release-vite_kerghan-base, release-vite_kerghan-base-arm64]
```

Job bodies (adapted from a working blueprint that existed in the soon-to-be-deleted
`aux/circleci_config.yml`, captured here before that folder disappears):

- **`build-and-release`** (`machine: true`): checkout, `scripts/deploy.sh update_deploy_branch`,
  `scripts/deploy.sh deploy`.
- **`upload_proxy_files`** (`darthjee/tent:0.10.1`, `working_directory: /home/app/app`):
  checkout, `bin/deploy_frontend.sh generate_key_file`, then
  `SOURCE=/var/www/html/ bin/deploy_frontend.sh upload`.
- **`copy_proxy_configuration`** (same image): checkout, generate key file,
  `SOURCE=proxy/prod_configuration/ DEPLOY_PATH=configuration/ bin/deploy_frontend.sh upload`,
  then two `copy_files` calls carrying over server-side state:
  `TARGET=configuration/locals.php DEPLOY_PATH=configuration/` and
  `TARGET=.htaccess DEPLOY_PATH=./` (the production SSH host runs Apache in front of Tent, same
  as Majora's infra, confirmed with the repo owner — kept even though no `.htaccess` exists in
  this repo, since it lives only on the host).
- **`upload_extension`** (same image): checkout, generate key file,
  `rm -rf proxy/extension/tests/`, then
  `SOURCE=proxy/extension/ DEPLOY_PATH=extension/ bin/deploy_frontend.sh upload`.
- **`upload_fe_files`** (`darthjee/vite_kerghan-base:0.1.0`): checkout, move `frontend/*` to
  root (same "Set folder" pattern as `jasmine`/`frontend-checks`), `yarn install`,
  `bin/deploy_frontend.sh build`, generate key file,
  `DEPLOY_PATH=static/ bin/deploy_frontend.sh generate_folder`, then
  `SOURCE=dist/ DEPLOY_PATH=static/ bin/deploy_frontend.sh upload`.
- **`release`** (`darthjee/vite_kerghan-base:0.1.0`): checkout, generate key file,
  `bin/deploy_frontend.sh release` (the atomic swap).

There's no Kerghan equivalent of Majora's `upload_admin_assets`/`link_photos`/`link_files` jobs
— Kerghan has no Django admin and no user-uploaded photos/files (see
`docs/agents/architecture/proxy.md`), so those don't apply here. Cache-warmer jobs
(`warm-up-cache`/`wake-navi`) are intentionally omitted — separate concern, separate issue.

### Reusing existing scripts

`bin/deploy_frontend.sh`, `scripts/deploy.sh`, and `scripts/render.sh` already implement every
action the job bodies above call, and the image versions they'll run under already match what's
pinned elsewhere in the repo (`vite_kerghan-base:0.1.0` per the root `version` file,
`tent:0.10.1` per `docker-compose.yml`). **No script changes are needed** — this issue is
purely about wiring `.circleci/config.yml` to call them.

### Dead `aux/` references — clean up all of them here

Since `aux/` is going away regardless, and this issue is already editing
`.circleci/config.yml`, fix **every** dangling `aux/`/`.bkp` reference in the repo, not just the
deploy-related ones:

- `.circleci/config.yml:51-52` — the "full pipeline... lives in `.circleci/config.yml.bkp`...
  see `aux/todo.md`" comment on the `upload_fe_files` job group. Replaced by this issue's actual
  implementation.
- `.circleci/config.yml:86` — i18n note citing `aux/todo.md`. Reword to drop the file reference
  (i18n is out of scope, already documented elsewhere without needing `aux/`).
- `.circleci/config.yml:133` — `release-image` comment citing `aux/base-image.md`. Reword to
  just say "mirrors Majora's `release-image` pattern" without the dead file pointer.
- `.claude/agents/infra.md:45` — same `aux/base-image.md` pointer; same fix.
- `docs/agents/environment-variables.md:57-58,72` — covered below (§ Infrastructure).

### Infrastructure — explicitly out of scope

No real Render service, SSH deploy host, or production domain exists for Kerghan yet.
Provisioning that infrastructure and filling in the actual CircleCI project variables (secrets)
is **not** part of this issue — the repo owner will provision it separately. This issue only
delivers the pipeline code itself; it won't run a real release until that provisioning happens.

As part of this issue, update `docs/agents/environment-variables.md` §4 ("CircleCI project
variables") to:

- Remove the references to the nonexistent `aux/circleci_config.yml` / `aux/todo.md`, and the
  now-inaccurate claim that the live `.circleci/config.yml` needs none of these.
- Confirm/adjust the variable list against what the new jobs actually consume: `RENDER_API_KEY`,
  `RENDER_SERVICE_NAME`, `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT`, `SSH_USER`,
  `SSH_REMOTE_DIR`, `SSH_REMOTE_TEMP_DIR` (already listed and believed accurate).
  `DOCKER_ID_USER`/`DOCKER_HUB_USERNAME`/`DOCKER_HUB_PASSWORD` stay listed as already used by
  the existing `release-image` jobs. The `NAVI_*`/`KERGHAN_NAMESPACE` cache-warmer variables
  stay out of scope, per the cache-warmer-is-a-separate-concern decision above.

### Edge cases

- **Upload/build failures**: safe by construction — the `release` job (the one that does the
  atomic `mv` on the SSH host) is gated by `requires:` on every upload/build job, including the
  backend's `build-and-release`. If anything fails, `release` simply never runs, and the
  previously-live frontend/proxy/backend keep serving unchanged.
- **Failure mid-`run_release` itself** (accepted risk, not fixed here): `run_release`'s remote
  command is a single `&&`-chained sequence (`rm old && mv live old && mv new live && rm old`).
  If the first `mv` succeeds but the second fails partway (e.g. disk full, permissions), the
  live path ends up missing entirely — the site would go down with no automatic fallback. This
  is inherited as-is from the proven Majora script; the repo owner has explicitly accepted this
  risk rather than hardening the swap in this issue.
- **Concurrent/out-of-order tag releases** (explicitly out of scope, deferred to future work):
  neither the backend's `checkLastVersion` guard nor the frontend/proxy jobs actually protect
  against two tags being pushed in quick succession and their CircleCI workflows finishing out
  of order — a newer tag's release could be silently overwritten by an older tag's workflow
  finishing later. Verified empirically that `scripts/deploy.sh`'s `isLatestCommit` check is a
  no-op in the normal tag-triggered flow (it only checks "is HEAD exactly on some tag", not "is
  it the newest tag in the repo/remote"), so this isn't actually guarded today either. A real
  fix would need to check the release's recency against the remote (e.g. `git ls-remote --tags`)
  at release time, not just local git history. Deferred — "we'll have a better mechanism in the
  future" — not part of this issue.

### Security

- **`StrictHostKeyChecking=no` on every SSH/rsync call** (`bin/deploy_frontend.sh`): accepts any
  host key on first connection, a MITM exposure on the initial handshake. Accepted risk — same
  as Majora's already-running production pipeline, no known incident. Not fixed in this issue;
  could be hardened later by pinning the host fingerprint via a new CircleCI variable and
  pre-populating `known_hosts`.
- **SSH private key written to disk in the CI container** (`~/ssh_key`, `chmod 600`): standard
  CircleCI pattern, container is ephemeral/discarded after the job. No action needed.
- **No secret leakage in build logs**: verified — none of the deploy scripts use `set -x`/`-v`
  or `echo` sensitive vars, and the `.circleci/config.yml` `run:` steps never embed secret
  values directly in the command text (only via env vars). `proxy/prod_configuration/` (the
  versioned proxy config) contains no secrets — the real `locals.php` lives only on the host and
  is pulled server-side via `copy_files`, never passing through CI.
- **Any tag push triggers a full production release with real secrets, no approval gate**:
  accepted as-is — single-owner repo, tags are only ever pushed intentionally. Not adding a
  CircleCI `type: approval` job for this.

### Performance

This is a release pipeline, not user-facing runtime code, so the relevant angle is release
latency/cost, not load or throughput:

- **Atomicity puts the backend's Render deploy on the frontend/proxy release's critical path.**
  `scripts/deploy.sh`'s `watch_deployment` polls with backoff (160s, 80s, 40s, 20s, then 10s per
  attempt, up to 20 attempts — ~7.7 minutes worst case before timing out as failed). The whole
  release now waits on whichever of the three (frontend, proxy, backend) is slowest — in
  practice, that's the backend's Render deploy. Accepted as-is: same timing already used in
  Majora's production pipeline, and a few extra minutes on a release (not a hot path) isn't a
  real problem.
- **CI executor cost**: `build-and-release` and the `release-image` jobs already use
  `machine: true` (slower to spin up, costs more than `docker` executors on CircleCI) — this is
  the existing pattern for jobs needing Docker-in-Docker / long-running processes, not something
  newly introduced here.
- **rsync payload size**: the Vite build and proxy config/extension are small today (tooling
  skeleton, no real app yet), so upload time isn't a concern now — revisit if/when the frontend
  grows substantially.

## Benefits

- A real, working release pipeline that lets tag pushes actually deploy Kerghan — currently a
  tag push does nothing beyond publishing base images.
- Atomicity across frontend, proxy, and backend prevents version skew during releases (no window
  where the new frontend talks to an old backend, or vice versa).
- Reuses already-written, already-proven scripts (`bin/deploy_frontend.sh`, `scripts/deploy.sh`,
  `scripts/render.sh`) — no new deploy machinery to build or trust, and no changes needed to
  them.
- Removes stale, misleading documentation and comments pointing at `aux/` files that never
  existed and are about to disappear for good, before they can cause confusion later.
