# Plan: Specs: fold client update specs into permanent docs and remove them

## Overview
Last sub-issue of the client update Epic (#414), following the spec lifecycle in `docs/agents/specs.md` and the #406 precedent (which created `docs/agents/standalone/client-config.md`). The client update specs move into a new permanent sub-doc, the user-facing docs and the `standalone/` files are brought in line with the shipped `kerghan update` and `restart-on-update`, and the spec folder is deleted. No behaviour changes.

## Context
- The specs live in `docs/agents/specs/client-update/`: `README.md`, `command.md`, `versions.md`, `setting.md`, `contracts.md`, `security.md` (the issue's original mention of a `client-update.md` file was wrong; only the folder exists).
- **Blocked by #416 and #417.** Start only once both are merged. Fold what actually shipped: where `standalone/bin/kerghan` differs from the spec (and the spec was updated in those PRs), the code and the updated spec win.
- Keep: every rule, "Exit codes and streams", "Alternatives rejected", security, and every "Required tests" section. Drop only transitional content: the sub-issue map, "Built by #41x" notes, sub-issue ordering, "#418 folds this in" remarks.
- The stable contracts (handoff interface, installer interface including the stamp line, release files, first upgrade) go in a clearly marked "Stable contracts" section, stating they can only grow in backward-compatible ways.

## Steps

- [01 — Write the client-update sub-doc](standalone/01-write-client-update-sub-doc.md)
- [02 — Update standalone.md and folder-structure.md](standalone/02-update-standalone-and-folder-structure.md)
- [03 — Update the root README](standalone/03-update-root-readme.md)
- [04 — Update standalone/ files and comment links](standalone/04-update-standalone-files-and-comments.md)
- [05 — Remove the specs and mark them completed](standalone/05-remove-specs-and-mark-completed.md)
- [06 — Verify no link points to the removed specs](standalone/06-verify-no-dangling-links.md)

## CI Checks
- `standalone/test`: `docker run --rm -v "$PWD:/code" -w /code bats/bats:1.11.0 standalone/test` (CI job running `bats standalone/test`). Only comments change in the client and tests, so it must stay green unchanged.

## Notes
- Docs under `docs/agents/` are normally architect territory; this plan gives them to the `standalone` agent because every file is about the standalone client and `standalone.md` is its primary reference (the architect reviews).
- `standalone.md` "Upgrading" and the README "Upgrade" currently say "Downgrades are not supported". With `update`, a client downgrade is allowed after a confirmation (and never restarts), while `kerghan up` still refuses to run an older image against a newer instance. Reword both so they agree with what #417 shipped instead of contradicting it.
- `scripts/bump_version.sh` (infra) needs no change: the stamp-line contract is documented in the sub-doc and the `install.sh` header, not in the script.
