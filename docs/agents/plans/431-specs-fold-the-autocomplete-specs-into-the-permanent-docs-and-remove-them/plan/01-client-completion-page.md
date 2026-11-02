# Write client-completion.md

Create `docs/agents/standalone/client-completion.md`. Model it on the header and TOC of `docs/agents/standalone/client-update.md`.

**Header paragraph:**

- "Part of [Standalone Distribution](../standalone.md)", then what the page defines, then "Product decision: epic #424".
- Code: `standalone/bin/kerghan` (`cmd_completion`, `completion_bash_script`, the word-list constants) and `standalone/install.sh` (`install_completion`).
- Tests: `standalone/test/completion.bats`, `completion_command.bats`, `completion_safety.bats`, `completion_sync.bats` and `install_completion.bats`, plus `helpers/completion.bash`.

Then a TOC.

**Sections, in this order, each with its own "Required tests":**

1. **Overview and scope.** From the README's Overview and Scope:
   - the two channels (`eval` and the `install.sh` file);
   - in scope;
   - out of scope: zsh/fish as future Epics, `update` versions, `compose` passthrough, `vault`, dynamic lookups, Windows, uninstall.
   Drop the "permanent docs … folded in by #431" bullet.
2. **`kerghan completion <shell>`.** All of `command.md`: shape, output and streams, no side effects, error cases, exact usage line and messages, required tests.
3. **What is completed.** All of `completion.md`:
   - registration and trailing space;
   - per-command completion and the per-position table, with the `Label` column kept verbatim;
   - never completed;
   - edge cases 1–17, numbering kept;
   - invocation and bash 3.2;
   - word lists and their sources;
   - required tests.
4. **Installer setup.** All of `install.md`:
   - constraint, rewritten in the present tense: the header already says "any failure of the client or `vault` install";
   - target, content, without `bash-completion` (detection and the test-only `KERGHAN_BASH_COMPLETION_PATHS` override);
   - never fatal, opt-out, overwrite, upgrade and downgrade, uninstall, messages;
   - required tests.
5. **Performance and security.** All of `security.md`: items 1–9, the `completion_safety.bats` table, the deny-list exceptions and the other-files table.
6. **Stable contracts.** All of `contracts.md`:
   - `completion bash`, `_kerghan`, `KERGHAN_COMPLETION`, the completion file path, the installer `update` contract;
   - the sync rule, with a link to `../contributing.md` where the rule now lives;
   - the internal (non-contract) notes on constants and the `BASH_SOURCE` guard;
   - required tests.
7. **Testing.** The README "Testing" section: harness and helpers table, fresh-shell tests, bash 3.2 (image, `bats_bash32` service, `standalone_completion_bash32` job, guard), file layout table, naming and coverage.
   - Keep "Rejected: the whole suite under 3.2" with a link to #433.
   - Rewrite the "no meta-test parsing the spec files" bullet as "parsing this page".
   - Drop "Out of scope here".

Keep the README's "Decisions summary" as a short bullet list under Overview, with its links pointing at this page's sections.

## Files to Change

- `docs/agents/standalone/client-completion.md`: new page.
