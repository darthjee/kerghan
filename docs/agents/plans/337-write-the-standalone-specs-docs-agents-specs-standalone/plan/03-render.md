# Write render.md

Create `docs/agents/specs/standalone/render.md`:

- Today: `build-and-release` points the Render service at the git tag (`update_deploy_branch`),
  triggers a deploy and polls `watch_deployment`; Render builds the production Dockerfile.
- New: `scripts/deploy.sh` triggers `POST /services/{id}/deploys` with
  `{"imageUrl": "docker.io/darthjee/kerghan:<CIRCLE_TAG>"}` and keeps polling;
  `update_deploy_branch` / `update_service_branch` removed; always the version tag, never `latest`.
- Rollback: deploy the previous tag (no rebuild). Migrations still run from the image entrypoint.
- `build-and-release` requires `release-kerghan` instead of the production-base jobs; the rationale
  in `docs/agents/architecture/infra.md` is rewritten (#341).
- Verified: Render allows switching the existing service's source to a prebuilt image in place
  (cite the changelog URL). Same service id and `kerghan.onrender.com` hostname: no new service,
  no env var copy, no Tent `$backendHost` change. Image-backed services have no auto-deploy.
- Manual checklist (done by the user): Settings → Build → Source → Existing Image,
  `docker.io/darthjee/kerghan:<tag>`; then let CI deploy. The production database is external.
- **Required tests:** a tag deploy calls the deploy API with `imageUrl` for that tag and waits for
  `live`; a failed status exits non-zero; no call changes the service branch.

## Files to Change
- `docs/agents/specs/standalone/render.md` — new.
