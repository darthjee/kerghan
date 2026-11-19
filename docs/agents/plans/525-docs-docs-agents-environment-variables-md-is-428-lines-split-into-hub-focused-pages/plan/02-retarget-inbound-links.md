# Retarget inbound links
Update every link whose target moved, so it names the new page and anchor:

- `#5-standalone-darthjeekerghan-standalone` → `environment-variables/standalone.md` in `README.md` (docs path prefix), `docs/agents/standalone.md`, `docs/agents/standalone/inner-stack.md`, `docs/agents/standalone/config-files.md` (adjust relative depth).
- `#1-backend-application-runtime` → `environment-variables/backend.md` and `#default-user-values-and-boot-validation` → `environment-variables/backend-setup.md#default-user-values-and-boot-validation` in `modules/auth/user-approval.md` and `modules/auth/default-user.md`.
- `#rotating-kerghan_integrations_key` → `environment-variables/key-rotation.md#rotating-kerghan_integrations_key` in `modules/integrations/security.md`.
- `docs/agents/specs.md` rows (lines 65–67, 71): point "Standalone", "section 1"/"section 5" and the variable mentions at the new pages; add the new pages where the hub is listed.
- Topic-specific plain-path references (e.g. `KERGHAN_ACCESS_TOKEN_TTL_MS` in `modules/auth/sessions.md` and `backend/routes/auth/shared.md`, GitHub App/OAuth config in `modules/integrations/*/config-and-proxy.md`, `GITHUB_TOKEN` in `architecture/infra/releases.md`, CI in `architecture/infra/ci-jobs.md`) may stay on the hub when the hub index is enough; retarget to the specific page when the topic clearly lives in one page.
- `docs/agents/folder-structure.md` — mention the new `environment-variables/` folder next to the hub entry.
- `.claude/agents/standalone.md` — keep the hub link, optionally add the `standalone.md` page.

## Files to Change
- `README.md`, `docs/agents/standalone.md`, `docs/agents/standalone/inner-stack.md`, `docs/agents/standalone/config-files.md`, `docs/agents/modules/auth/user-approval.md`, `docs/agents/modules/auth/default-user.md`, `docs/agents/modules/integrations/security.md`, `docs/agents/specs.md`, `docs/agents/folder-structure.md`, `.claude/agents/standalone.md` — retarget links; further files from `grep -rn environment-variables` only where the topic moved.
