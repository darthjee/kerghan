# Issue: Move standalone documentation into the permanent docs

## Description

Part of epic #336. The standalone specs (`docs/agents/specs/standalone/`) are temporary and
are removed in #348. Before that, everything that must outlive them moves into the permanent
docs, so the standalone distribution (`darthjee/kerghan-standalone`, the `kerghan` client
and its installer) stays documented after the specs are gone.

**Owner:** architect (cross-cutting docs; the `standalone` and `infra` agents may be consulted
for accuracy).

## Problem

- The only full description of standalone Kerghan lives in the temporary specs: install,
  client commands, `~/.kerghan/config`, the env contract, the inner stack and the caveats.
- `docs/agents/external.md` still says Vault is "not used by Kerghan yet".
- `docs/agents/architecture/infra.md` covers `release-kerghan-standalone` but not the
  `release-kerghan-assets` job or the installer release assets.
- `docs/agents/folder-structure.md` does not list `standalone/` or
  `dockerfiles/kerghan_standalone/`.

## Expected Behavior

- Someone who reads only the permanent docs can install, run, configure and upgrade
  standalone Kerghan.
- No permanent doc links to `docs/agents/specs/standalone/`. The one exception is the
  `docs/agents/specs.md` index entry, which #348 removes together with the folder.

## Solution

- **`README.md`**: a short, user-facing "Run Kerghan standalone" section. It covers the install
  one-liner, `kerghan up`, the requirements (Docker with Sysbox or `--privileged`, on Linux
  or macOS), the online and offline variants, the `~/.kerghan/` layout and the caveats below.
  It links to the new permanent doc for details.
- **New `docs/agents/standalone.md`** (linked from `docs/agents/index.md`), the permanent
  reference:
  - the `kerghan` client commands and the `~/.kerghan/config` keys;
  - the installer's behavior and how to upgrade;
  - the inner compose stack (`mysql`, `kerghan`, `tent`) and how the frontend and Tent
    configuration are bind-mounted;
  - how the online and offline images differ (tarball preload).
- **`.claude/agents/standalone.md`**: point the agent at `docs/agents/standalone.md` as its
  reference, not the specs.
- **`docs/agents/environment-variables.md`**: a "Standalone" section with the env contract
  (required, internal, overridable, pass-through, excluded).
- **`docs/agents/folder-structure.md`**: add `standalone/` and `dockerfiles/kerghan_standalone/`
  (and `bin/release_kerghan_standalone.sh` in the `bin/` row).
- **`docs/agents/architecture/infra.md`**: document the `release-kerghan-assets` job and the
  installer release assets next to the existing `release-kerghan`/`release-kerghan-standalone`
  sections.
- **`docs/agents/external.md`**: Vault is now used by Kerghan (the standalone image).
- **Caveats** to document (README summary, full detail in `docs/agents/standalone.md`):
  - HTTPS: because of the `Secure` cookie, plain HTTP works only on `localhost`; elsewhere,
    put a TLS reverse proxy in front;
  - back up `~/.kerghan/kerghan.env`: losing it locks out the stored integration credentials;
  - the MySQL password is fixed when the volume is created;
  - older inner images make the disk grow; document a manual cleanup command;
  - downgrades are not supported, and only one instance can run per host;
  - standalone databases contain the demo user (a future epic will handle it).

### Out of scope

- Render deploy docs (the image-based Render deploy): #341 documents its own change.
- Removing `docs/agents/specs/standalone/` and its `docs/agents/specs.md` entry: #348.

### Depends on

#341, #345 and #346.

### Acceptance criteria

- No permanent doc (anything outside `docs/agents/specs/`, `docs/agents/issues/` and
  `docs/agents/plans/`) links to `docs/agents/specs/standalone/`.
- Someone who reads only the permanent docs can install, run, configure and upgrade
  standalone Kerghan.

## Benefits

- #348 can delete the specs without losing knowledge.
- Users get one clear README entry point, and agents get one permanent reference.
