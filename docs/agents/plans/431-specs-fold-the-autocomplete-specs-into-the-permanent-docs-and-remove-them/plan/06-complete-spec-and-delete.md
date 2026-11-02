# Complete the spec entry and delete the folder

**`docs/agents/specs.md`:**

- **"Active specs":** remove the Auto-complete row and set the list to read "none", following the note under the table.
- **"Completed specs":** add a row:
  - Feature: `Auto-complete (bash completion for the \`kerghan\` client: \`kerghan completion bash\` / \`install.sh\` setup)`.
  - Now defined in:
    - [standalone/client-completion.md](standalone/client-completion.md) (command, what is completed, installer setup, security, stable contracts, testing, required tests);
    - [standalone.md](standalone.md) (command list, `completion` summary, testing);
    - [contributing.md](contributing.md) (sync rule);
    - [standalone/client-update.md](standalone/client-update.md) (installer interface);
    - `README.md` "Run Kerghan standalone";
    - the `standalone/install.sh` header (`KERGHAN_COMPLETION`).
  - Product decision: #424.

**Delete** `docs/agents/specs/auto-complete/` (all six files) with `git rm -r`. If `docs/agents/specs/` is then empty, git drops it. That is fine: `specs.md` is the hub and the lifecycle recreates folders.

**Acceptance check:** run
`grep -rn "specs/auto-complete" . --exclude-dir=.git --exclude-dir=issues --exclude-dir=plans`
It must print nothing. Also grep for `auto-complete/` (relative links such as `auto-complete/README.md`) and fix any hit.

## Files to Change

- `docs/agents/specs.md`: move the entry to "Completed specs".
- `docs/agents/specs/auto-complete/`: deleted.
