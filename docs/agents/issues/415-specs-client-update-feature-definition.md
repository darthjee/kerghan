# Issue: Specs: client update feature definition

## Description

First sub-issue of the client update Epic (#414). Write the feature specs for the new `kerghan update [VERSION]` client command and its `restart-on-update` setting, following the lifecycle in `docs/agents/specs.md` (precedent: the client config specs, #403).

Feature summary (the full context and every decision are in #414):

- `kerghan update [VERSION]` updates the client and the image together: it resolves the target version (`VERSION` or the latest release), runs that release's `install.sh` with `KERGHAN_VERSION=<target>` and `KERGHAN_INSTALL_DIR=<directory of the running client>`, then `exec`s the new client (a hidden `update --finish` step), which pulls the image (online or `-offline`) and restarts according to the setting.
- Already up to date: a no-op printing "already up to date"; `--force` reinstalls.
- Downgrade: allowed after a warning and a confirmation; `--yes` skips the confirmation (required without a TTY).
- New setting `restart-on-update=ask|always|never` (default `ask`). `--restart` / `--no-restart` override it per run. The wizard always asks it, after `bind`. `kerghan configure` validates and unsets it like any other key.
- No rollback when the pull or the restart fails. There is no restart when the instance is not running. An `image-tag` override is kept with a warning. After an update, a hint prints the `docker image rm` command for the old image.

### Scope

In scope:

- The spec folder `docs/agents/specs/client-update/`, laid out as described in [Spec layout](#spec-layout) (under Solution).
- The "Active specs" entry in `docs/agents/specs.md`.
- The exact `usage` synopsis lines for `update` and for the `restart-on-update` setting, which the implementation sub-issues copy verbatim.
Also in scope:

- **Exact user-facing messages and exit codes** in `command.md` and `versions.md`: "already up to date", the downgrade warning and its `[y/N]` prompt, the `kerghan up` and `docker image rm` hints, the `image-tag` override warning, and the `updated X -> Y` line. The implementation and its bats tests then have a fixed target, as with the `configure` and `wizard` outputs in #403.
- **`FIRST_UPDATE_VERSION`:** the specs define it as "the first release that contains `update`", without fixing a number. #417 sets the constant, and a pre-release check (in #417 or at the version bump) confirms it matches the release that ships it.
- **Wizard question:** the exact text and position of the `restart-on-update` question in `setting.md` (`Restart after update (ask/always/never)`, after `bind`), written verbatim like the usage lines.

Out of scope:

- Any code, including `standalone/bin/kerghan`, `standalone/install.sh` and the client `usage`.
- `standalone/config.example`, `docs/agents/standalone.md` and the root `README.md` (the fold sub-issue of #414).
- **Other issue bodies:** when writing the specs changes a decision, #416, #417 and #418 are not edited. The specs win, per the lifecycle in `docs/agents/specs.md`; the PR description mentions the change.
- **#418's fold target** (the permanent page the specs fold into, and moving the entry to "Completed specs"), which is settled in #418 itself.
- **Release and CI changes** (e.g. `scripts/bump_version.sh`). The specs only state that the stamp line format is a contract.

Owner: the architect writes the specs. The standalone agent reviews, within the same PR, the parts that touch the client's existing behaviour (the config parser, the wizard order, `kerghan up`'s upgrade logic).

If writing the specs shows that a decision in #414 conflicts with the client's current behaviour, adjust the decision in the spec and call it out in the PR description. Do not stop to ask.

## Problem

`update` spans two implementation sub-issues (the setting and the command) and creates contracts between client versions (the handoff and the installer) that cannot be changed after release. Without one agreed definition, the sub-issues would make their own decisions and drift apart.

## Expected Behavior

- The six files of [Spec layout](#spec-layout) (under Solution) exist under `docs/agents/specs/client-update/`, cover every decision in #414, and write down the settled decisions (under Solution). Each spec file ends with a "Required tests" section.
- `docs/agents/specs.md` lists the feature under "Active specs".
- The PR description confirms that no installer sub-issue is needed, or names the blocker that requires one.

## Solution

### Settled decisions

- **Latest-version resolution (`versions.md`):** the client downloads the installer and reads its stamp line (`KERGHAN_VERSION="x.y.z"`).
  - Without `VERSION`: `releases/latest/download/install.sh`.
  - With `VERSION`: `releases/download/<v>/install.sh`. A failed download (e.g. 404) means the version does not exist (edge case 1 of #414), and nothing changes.
  - The stamp must match the requested `VERSION`; a mismatch is an error.
  - That same downloaded file is then run for the install, so one download covers resolution, the existence check and the install. No GitHub API and no credentials.
- **Handoff contract (`contracts.md`):** `exec "<install dir>/kerghan" update --finish`, with its context in environment variables, not arguments:
  - `KERGHAN_UPDATE_FROM=<old version>`, used in messages (e.g. `updated 0.9.0 -> 0.9.1`).
  - `KERGHAN_UPDATE_RESTART=always|never`, set only when `--restart` / `--no-restart` was given. When it is unset, the new client reads `restart-on-update`.
  - The previous image (for the `docker image rm` hint) is not passed: the new client reads it from the running container before restarting.
  - Stable rules: `update --finish` stays accepted by every later client, a missing variable falls back to its default, and an unknown variable is ignored.
- **Downgrade below the first version that ships `update` (`versions.md`):** allowed. The old client compares the target with a constant (e.g. `FIRST_UPDATE_VERSION`). When the target is older, it replaces the client, skips the handoff (no env update, no pull, no restart), and prints `run 'kerghan up' to switch the instance to <v>`. The usual downgrade warning and confirmation (or `--yes`) still apply.
- **Installer (`contracts.md`):** no addition is needed. `update` relies only on the existing installer contract (`KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR`, the `KERGHAN_VERSION="x.y.z"` stamp line), since a downgrade runs older installers that already shipped. No installer sub-issue is planned. If writing the specs uncovers a blocker, say so in the PR so one can be added to #414 before #417.
- **Stable contracts (`contracts.md`):** the handoff, installer (including the stamp line format, which `scripts/bump_version.sh` must keep) and release-file (`install.sh` and `kerghan` under `releases/download/<v>/` and `releases/latest/download/`) contracts are written down as stable.

### Spec layout

The specs follow the hub convention in `docs/agents/specs.md` (one folder, a `README.md`, files split by concern), the same shape as the client config specs (#403). There is no separate `docs/agents/specs/client-update.md` file: `docs/agents/specs.md` is the hub, and `README.md` is the feature's entry point.

```
docs/agents/specs/client-update/
├── README.md      overview, purpose, scope, product decision (#414), behaviour decisions summary, index
├── command.md     `kerghan update [VERSION]`: usage synopsis, flags (--force, --yes, --[no-]restart),
│                  the flow (install → handoff → env → pull → restart → hint), messages, exit codes,
│                  instance-state and failure edge cases (no rollback)
├── versions.md    VERSION validation, latest-version resolution, comparison (no-op, --force,
│                  downgrade + confirmation, downgrade below the first `update` version)
├── setting.md     `restart-on-update`: values, default, parser, configure, wizard placement,
│                  usage and config.example lines
├── contracts.md   stable contracts: the handoff interface (`update --finish`), the installer
│                  interface (+ whether an installer addition is needed), the release files
└── security.md    trust model, download-to-file, temp files, exec of the exact path,
                   secrets, sudo and credentials, downgrade risk
```

- Every edge case from #414 goes into the file it belongs to (e.g. the `image-tag` override in `command.md`, a symlinked client in `security.md`). There is no separate `edge-cases.md`.
- Every spec file except `README.md` ends with a "Required tests" section, next to the rules it verifies.
- **Who reads what:** #416 (setting) reads `setting.md`; #417 (command) reads `command.md`, `versions.md`, `contracts.md` and `security.md`; #418 (fold) reads all of them.

### Additional edge cases

These edge cases come from the settled decisions above. They add to the ones in #414, and each goes into the spec file named.

#### Version resolution (`versions.md`)

1. **Stamp line missing or malformed** in the downloaded installer: fail, nothing changes.
2. **Latest release older than the current client** (e.g. a release was pulled, or a newer local build): a plain `kerghan update` prints `kerghan X is newer than the latest release Y` and does nothing. A downgrade only happens with an explicit `VERSION`.
3. **Current client is not a release** (`KERGHAN_VERSION` is not semver, e.g. a dev build): no comparison is possible. Warn, then update to the target without the no-op or downgrade logic (the same idea as `kerghan up`'s handling of non-release images).
4. **`VERSION` equal to the current version:** the same no-op as an up-to-date `update` ("already up to date"); `--force` reinstalls.

#### Handoff (`contracts.md`)

5. **`KERGHAN_UPDATE_*` already set in the user's shell:** the old client always sets or unsets both variables explicitly before the `exec`, so stray values never leak into a normal update.
6. **`KERGHAN_VERSION` set in the user's shell:** the client always passes `KERGHAN_VERSION=<target>` to the installer explicitly, so the shell value never applies.
7. **The `exec` fails** (the new file is missing or cannot be executed): error out. The client may already be replaced, so print the `kerghan up` hint.
8. **`update --finish` run by hand:** hidden and undocumented. It only runs the finish steps (env, pull, restart), so it is harmless.
9. **Older target that ships `update` receives unknown variables** from a newer client during a downgrade: they are ignored under the contract rule. The spec states this case explicitly.

#### Flags (`command.md`)

10. **`--restart` and `--no-restart` both given:** usage error.
11. **`--force` on a downgrade:** `--force` only affects the same-version case. A downgrade still needs the confirmation or `--yes`.
12. **`--yes` on an upgrade or a no-op:** accepted, with no effect.

## Benefits

- One agreed definition that #416, #417 and #418 build against, so the setting and the command can't drift apart.
- The contracts between client versions (handoff, installer, release files) are fixed before the first release that ships `update`, when they can still change.
- Exact messages, exit codes and required tests give the implementation and its bats tests a fixed target.
