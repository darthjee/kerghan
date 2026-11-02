# Issue: Specs: fold the autocomplete specs into the permanent docs and remove them

## Description

Last sub-issue of the shell autocomplete Epic (#424). Fold the lasting content of `docs/agents/specs/auto-complete/` into the permanent docs, delete the spec folder, and move its entry to "Completed specs" in `docs/agents/specs.md`, following the lifecycle there (precedents: #406, #418).

### Scope

In scope:

- **A new permanent page, `docs/agents/standalone/client-completion.md`**, named like `client-config.md` and `client-update.md` and shaped like `client-update.md`. It holds every lasting decision of the five spec files:
  - the command (`command.md`): shape, streams, no side effects, error cases, exact messages;
  - what is completed (`completion.md`): registration and the trailing-space rule, the per-position table, what is never completed, edge cases 1–17, bash 3.2, word-list sources;
  - the installer step (`install.md`): target path, content, hint and detection (including the test-only `KERGHAN_BASH_COMPLETION_PATHS`), never fatal, opt-out, overwrite, upgrade and downgrade, uninstall, exact messages;
  - performance and security (`security.md`);
  - the stable contracts (`contracts.md`): `completion bash`, `_kerghan`, `KERGHAN_COMPLETION`, the file path, the installer's `update` contract;
  - the testing approach (README "Testing": harness, fresh-shell tests, the bash 3.2 service, file layout, naming and coverage);
  - each section's "Required tests".

  The spec-only scaffolding is dropped, not folded: the sub-issue map and order, open markers, "who reads what", and the "out of scope here" notes about #429/#430. The page states scope and out of scope (zsh/fish as future Epics, release versions, `compose` passthrough, `vault`, dynamic lookups, Windows, uninstall), and links #433 for running the whole suite under bash 3.2.
- **`docs/agents/standalone.md`:**
  - add `kerghan completion bash` to the command list and a short `completion` summary linking the new page;
  - remove "shell completion" from "Out of scope";
  - add completion to the "Testing" table (`completion*.bats` and `install_completion.bats`, the `standalone_completion_bash32` CI job and the `bats_bash32` service);
  - add a one-line pointer to the sync rule.
- **`docs/agents/contributing.md`:** the full sync rule in the Definition of Done. Any PR that adds or changes a client command, flag, `configure` key or fixed value updates the completion in the same PR; `standalone/test/completion_sync.bats` enforces it.
- **`docs/agents/standalone/client-update.md` "Installer interface":** narrow "exits non-zero on any failure" to the client and `vault` install (the completion step only warns), matching the `install.sh` header #430 already reworded. Note that `update` does not pass `KERGHAN_COMPLETION`, so the step is on by default on updates.
- **`README.md` "Run Kerghan standalone":** how completion is enabled (automatic with `bash-completion`, otherwise the `source` line from the installer's hint or the `eval "$(kerghan completion bash)"` line) and how to opt out (`KERGHAN_COMPLETION=false`).
- **The `install.sh` header:** already updated by #430 (`KERGHAN_COMPLETION` in Variables, the narrowed exit sentence). Only repoint the link if needed; no rewording.
- **Comment-only repointing:** these files have comments that link into the spec folder; point them at the new page (or the right section of it):
  - `standalone/bin/kerghan`;
  - `standalone/test/completion.bats`, `completion_command.bats`, `completion_safety.bats`, `completion_sync.bats` and `install_completion.bats`;
  - `standalone/test/helpers/completion.bash`;
  - `dockerfiles/bats_bash32/Dockerfile`;
  - `.circleci/config.yml`.
- **`docs/agents/specs.md`:** move the entry from "Active specs" to "Completed specs", pointing at the pages that now hold it, with #424 as the product decision. "Active specs" then reads "none".
- Delete `docs/agents/specs/auto-complete/`.

Out of scope:

- Any behaviour change. The only code-file edits are the comment-only link updates above.
- The zsh and fish Epics.
- #433 (the whole suite under bash 3.2).

Owner: the architect, which also does the comment-only edits in the standalone and infra files. They need no specialist work.

## Expected Behavior

- `docs/agents/specs/auto-complete/` no longer exists, and every decision it held lives in `docs/agents/standalone/client-completion.md` or one of the other permanent docs listed above.
- `docs/agents/specs.md` lists the feature under "Completed specs", and "Active specs" reads "none".
- No doc still lists shell completion as out of scope.
- The sync rule is in `contributing.md` and pointed at from `standalone.md`, both naming `completion_sync.bats`.
- `grep -rn "specs/auto-complete"` over the repo (excluding `docs/agents/issues/` and `docs/agents/plans/`) returns nothing.
- No behaviour changes: the bats suite (`standalone_tests` and `bats_bash32`) still passes unchanged.

## Benefits

The feature's definition lives in its permanent home next to the other client pages, contributors see the sync rule where they look for PR requirements, and no code comment points at a deleted folder.
