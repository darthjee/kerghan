# Issue: Specs: fold client update specs into permanent docs and remove them

## Description

Last sub-issue of the client update Epic (#414). Once `restart-on-update` (#416) and `kerghan update` (#417) have landed, fold the client update specs (`docs/agents/specs/client-update/`) into the permanent docs and remove them, following the lifecycle in `docs/agents/specs.md` (precedent: #406, which created `docs/agents/standalone/client-config.md`).

### Where the content goes

- **New sub-doc `docs/agents/standalone/client-update.md`**, the permanent home of the feature definition, folded from every spec file (`README.md`, `command.md`, `versions.md`, `setting.md`, `contracts.md`, `security.md`): usage and options, the flow (resolve → compare → install → hand off → finish), version validation/resolution/comparison and downgrade, the `restart-on-update` setting, exit codes and streams, security, the "Alternatives rejected" rationale, and the "Required tests" sections. Only transitional content is dropped: the sub-issue map, the "built by #41x" notes and the sub-issue ordering.
- **Stable contracts** — the `update --finish` handoff interface, the installer interface (including the stamp line `scripts/bump_version.sh` must keep writing) and the release files — are recorded in that sub-doc under a clearly marked "Stable contracts" section, stating that they can only grow in backward-compatible ways.
- **`docs/agents/standalone.md`**: add `update` to the command list with a short summary, mention `restart-on-update`, and link the new sub-doc.
- **Root `README.md`** ("Run Kerghan standalone"): upgrading with `kerghan update`, plus the note that clients 0.8.2 and older (older than `FIRST_UPDATE_VERSION`) need one manual run of the installer followed by `kerghan up` to reach the first version with `update`.
- **`standalone/config.example`**: check the `restart-on-update` lines added by #416 and fix any link to the spec.
- **`standalone/install.sh` header comment**: document the stamp line and the `KERGHAN_VERSION` / `KERGHAN_INSTALL_DIR` interface as a stable contract, pointing at the new sub-doc.
- **Code comments and tests** (`standalone/bin/kerghan`, `standalone/test/*.bats`, `scripts/bump_version.sh`): repoint any reference to `docs/agents/specs/client-update/` to the new sub-doc (comment-only changes).
- **`docs/agents/folder-structure.md`**: list the new sub-doc if the precedent pattern requires it.

### Removal

- Delete `docs/agents/specs/client-update/`.
- In `docs/agents/specs.md`, move the entry from "Active specs" (which then reads "none") to "Completed specs", pointing at the permanent docs that now hold it (product decision #414).

### Scope

In scope: docs, plus comment-only link updates in code and tests.

Out of scope: any behaviour change in the client, the installer or the release jobs.

### Dependencies

Blocked by #416 and #417; do not start until both are merged. It folds what they actually shipped, so any decision they changed in the specs is folded as shipped.

## Problem

Specs are temporary by design. Once the feature ships, its decisions must live in the permanent docs, or they are lost when the specs are removed. The stable contracts are especially at risk: they bind every future release, since an update always runs code from two versions.

## Expected Behavior

- `docs/agents/standalone/client-update.md` describes `kerghan update`, `update --finish`, `restart-on-update`, security, required tests and the stable contracts.
- `docs/agents/standalone.md`, the root `README.md` (including the first-upgrade note), `standalone/config.example` and the `install.sh` header reflect the shipped feature.
- `docs/agents/specs/client-update/` is gone; "Active specs" reads "none" and "Completed specs" lists the client update feature.
- No link anywhere (docs, code comments, tests) points to the removed specs.
