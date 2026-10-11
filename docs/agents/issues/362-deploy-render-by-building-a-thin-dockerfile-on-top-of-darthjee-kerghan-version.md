# Issue: Deploy Render by building a thin Dockerfile on top of darthjee/kerghan:<version>

## Description

Restore Render deploys, broken since #341, by making the Git-backed `kerghan` Render service build
a one-line Dockerfile (`FROM darthjee/kerghan:<version>`) from the release tag, instead of asking
Render to deploy the image by `imageUrl`. `scripts/bump_version.sh` keeps that Dockerfile's version
in sync with each release.

## Problem

#341 (PR #359) switched the Render deploy to an image-backed deploy: `scripts/deploy.sh deploy`
calls `POST /v1/services/{id}/deploys` with `{"imageUrl": "docker.io/darthjee/kerghan:<tag>"}`.
The `kerghan` Render service is a Git-backed (Docker build) service, and Render rejects that
request. The 0.6.0 `build-and-release` job failed on its Deploy step:

```
DEPLOYING docker.io/darthjee/kerghan:0.6.0
curl: (22) The requested URL returned error: 400
deploy request failed: {"message":"cannot deploy images for non-image backed service"}
```

Production is still on 0.5.0 (the service's branch); 0.6.0 was published but never deployed.

## Expected Behavior

- On a semver tag, `build-and-release` points the Render service's branch at the tag, triggers a
  deploy, and watches it until `live`; Render builds `dockerfiles/production_kerghan/Dockerfile`,
  which is only `FROM darthjee/kerghan:<tag>`, so production runs exactly the image published by
  `release-kerghan`.
- The deploy fails fast, before touching Render, if that Dockerfile's `FROM` tag does not match
  the release tag.
- `scripts/bump_version.sh <version>` also updates the thin Dockerfile's `FROM` tag.
- The Docker Hub image `darthjee/kerghan` is built from `dockerfiles/release_kerghan/Dockerfile`
  (renamed, content unchanged).

## Solution

Go back to having Render build an image from git, but make that build trivial: a Dockerfile whose
only content is `FROM darthjee/kerghan:<version>` (nothing else added — the `ENTRYPOINT` is
inherited). Render builds it from the release tag, so production still runs exactly the image
published by `release-kerghan`.

The Render service already builds from `./dockerfiles/production_kerghan/Dockerfile` (Git-backed,
`dockerContext: .`, auto-deploy on commit). The thin Dockerfile takes over that path, so **no
Render dashboard change is needed**, and the current full production Dockerfile is renamed to
`release_kerghan` (the image that goes to Docker Hub).

### Scope

#### In scope

1. **Rename** `dockerfiles/production_kerghan/` (Dockerfile + `entrypoint.sh`) to
   `dockerfiles/release_kerghan/`, and update every reference:
   - `bin/release_kerghan.sh` (`-f dockerfiles/...`);
   - `docker-compose.yml`;
   - the moved Dockerfile's own `COPY ./dockerfiles/production_kerghan/entrypoint.sh` line;
   - docs: `docs/agents/architecture/infra.md`, `docs/agents/standalone.md`,
     `docs/agents/folder-structure.md`, `AGENTS.md`, and `.claude/agents/infra.md`.
2. **New thin** `dockerfiles/production_kerghan/Dockerfile` containing only
   `FROM darthjee/kerghan:<version>`, pinned to the next release version.
3. **`scripts/bump_version.sh`** also rewrites the version in that Dockerfile's `FROM` line.
4. **Revert the deploy scripts to the Git-backed flow** (`scripts/deploy.sh`, `scripts/render.sh`):
   - restore `update_service_branch` (PATCH `{"branch": "<tag>"}`) and `update_deploy_branch`;
   - plain `POST /v1/services/{id}/deploys` with no `imageUrl` body;
   - remove `image_url`, `IMAGE_REPOSITORY`, `deploy_image` and the `imageUrl` handling.
5. **Keep the #341 hardening that is not image-specific**: `pre_deploy_failed` treated as a
   failure, the "render service not found" error, `--fail-with-body` plus the deploy-id check, and
   the `ubuntu-2204:current` machine pin.
6. **CircleCI**: `build-and-release` updates the service branch to `CIRCLE_TAG`, then triggers the
   deploy and watches it until `live`; it keeps requiring `release-kerghan`, so
   `darthjee/kerghan:<tag>` exists before Render builds the thin Dockerfile.
7. **Tests and docs**: update `scripts/test/deploy.bats` (and stubs) to the branch-update + plain
   deploy flow, and rewrite the "Render deploy and rollback" section of `infra.md` (drop the
   image-backed description and the manual "Existing Image" checklist).

#### Out of scope

- **Rollback**: no rollback command is needed; `deploy_image` is removed.
- **Render dashboard changes**: none needed (the Dockerfile path stays the same). Any manual Render
  action, if one turns out to be required, is done by the user.
- **`production_kerghan-base`**: the base image name, its `version` file entry, `bin/image.sh` and
  its `release-production_kerghan-base(-arm64)` CI jobs stay unchanged.
- The content of the release (Docker Hub) Dockerfile and `entrypoint.sh` is unchanged — only moved.

### Edge cases

1. **Auto-deploy on branch change** — the service has auto-deploy on commit. A tag never receives
   new commits, and CI watches the deploy id returned by its own `POST`, so a possible extra
   deploy triggered by the branch PATCH is harmless. Keep the PATCH-then-POST flow that deployed
   releases up to 0.5.0; disabling auto-deploy is not needed.
2. **Thin Dockerfile out of sync with the tag** — if a tag is cut without running
   `bump_version.sh`, the `FROM` line would still point at the previous version and Render would
   silently redeploy the old image. Add a guard to `scripts/deploy.sh deploy`: before patching the
   branch, read the `FROM` tag in `dockerfiles/production_kerghan/Dockerfile` and fail if it is not
   `CIRCLE_TAG`. Cover it with bats tests.
3. **Image not yet published** — `build-and-release` must keep requiring `release-kerghan`, so
   `darthjee/kerghan:<tag>` exists before Render builds the thin Dockerfile.
4. **Recovering 0.6.0** — the 0.6.0 tag contains the image-deploy scripts, so it cannot be
   redeployed. Production goes straight from 0.5.0 to the first release containing this fix
   (e.g. 0.6.1), whose boot applies 0.6.0's migrations along with its own. Expected; nothing to
   implement.
5. **Multi-arch** — `darthjee/kerghan:<tag>` is an amd64+arm64 manifest; Render's amd64 build
   resolves the right variant. Nothing to do.
6. **Non-latest tag builds** — `checkLastVersion` stays, so CI re-runs on older tags keep skipping
   the deploy.

### Testing strategy

**Automated** — rewrite `scripts/test/deploy.bats` (stubbed `curl`/`git`, run by the
`scripts_tests` CI job or `docker-compose run --rm scripts_tests`):

- `deploy` on the latest tag PATCHes `{"branch": "<tag>"}`, then sends a `POST /deploys` without
  `imageUrl`, then watches until `live`;
- the version guard: `deploy` fails, with no PATCH or POST, when the thin Dockerfile's `FROM` tag
  differs from `CIRCLE_TAG`;
- failed statuses (`build_failed`, `update_failed`, `pre_deploy_failed`, `canceled`,
  `deactivated`) and the timeout exit non-zero (kept from #341);
- service not found and a rejected deploy request exit non-zero with an error (kept);
- a non-latest tag skips the deploy;
- the image-specific tests (`imageUrl` body, `latest`/empty tag rejection, `deploy_image`) are
  removed.

`scripts_tests` stays a requirement of `build-and-release`.

**`bump_version.sh`** — no automated test (it uses macOS `sed -i ''`, which does not run in the
Linux bats container, and making it portable is out of scope). Verified in review: the bump PR's
diff shows the new version in the thin Dockerfile's `FROM` line.

**Manual** — the user smoke-tests the first release after the fix: Render builds the thin
Dockerfile, the deploy goes `live`, and production serves the new version.

## Benefits

- Production deploys work again, with no Render dashboard change (the service's Dockerfile path is
  unchanged).
- Render still runs the exact released image; its build is a trivial `FROM`, not a full rebuild.
- The version guard prevents silently redeploying an old image when a release skips the bump.
- Clearer naming: `release_kerghan` is what is published, `production_kerghan` is what Render runs.
