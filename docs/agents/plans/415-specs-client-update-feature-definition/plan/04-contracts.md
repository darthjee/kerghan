# contracts.md: handoff, installer and release files

Write `docs/agents/specs/client-update/contracts.md`. Mark every contract as **stable**: once a release ships `update`, it cannot change incompatibly.

- **Handoff interface:**
  - `exec "<install dir>/kerghan" update --finish`. That is the exact installed path, never a `PATH` lookup.
  - Context in environment variables: `KERGHAN_UPDATE_FROM=<old version>`, and `KERGHAN_UPDATE_RESTART=always|never`, set only when `--restart` / `--no-restart` was given. When it is unset, the new client reads `restart-on-update`.
  - The old client always sets or unsets both variables explicitly before the `exec`, so stray shell values never leak in.
  - Rules: `update --finish` stays accepted by every later client, a missing variable falls back to its default, and an unknown variable is ignored. That covers an older target receiving variables from a newer client during a downgrade.
  - `update --finish` is hidden and undocumented in `usage`. Run by hand, it only runs the finish steps.
  - The previous image is not passed; the new client reads it from the running container.
- **Installer interface:**
  - `update` relies only on what already shipped: `KERGHAN_VERSION=<target>` (always passed explicitly, so a shell value never applies), `KERGHAN_INSTALL_DIR=<real directory of the running client>`, and the stamp line `KERGHAN_VERSION="x.y.z"`, whose format `scripts/bump_version.sh` must keep.
  - Explain why: a downgrade runs older installers that can never gain new flags.
  - State the conclusion: **no installer addition is needed.** If writing this file uncovers a blocker, record it here and in the PR description.
- **Release files:** `install.sh` and `kerghan` stay published at `releases/download/<v>/` and `releases/latest/download/`.
- **First upgrade:** clients 0.8.2 and older have no `update`, so moving to the first version with `update` means one manual install (to be documented by #418).
- **Required tests:** the old client sets and unsets both variables (including when they are pre-set in the environment); `--finish` with missing and unknown variables; `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR` passed explicitly to the installer; the exec targets the installed path.

## Files to Change
- `docs/agents/specs/client-update/contracts.md` — new.
