# Update standalone.md and folder-structure.md

**`docs/agents/standalone.md`:**

- **"Out of scope"** (around line 45): remove "shell completion" from the list.
- **The `kerghan` client command block** (around line 145): add a line such as
  `kerghan completion bash                 # print the bash completion script (eval "$(kerghan completion bash)")`.
  Keep the comment column aligned.
- **Command summaries:** add a `#### \`completion\`` subsection next to `#### \`update\`` (around line 292). It needs:
  - a short summary: prints a static script on stdout, `bash` is the only shell, `install.sh` installs it into the bash-completion user dir, opt out with `KERGHAN_COMPLETION=false`;
  - a link to [client-completion.md](standalone/client-completion.md);
  - one line on the sync rule, linking `contributing.md` and naming `standalone/test/completion_sync.bats`.
- **"Install and upgrade" → "Installing the client":** one sentence that the installer also writes the bash completion file, with a link to the page's installer section.
- **"Testing" table:** extend the "Client and installer tests" row to mention:
  - the completion tests (`completion*.bats`, `install_completion.bats`; see the "Required tests" sections of [Client completion](standalone/client-completion.md));
  - the bash 3.2 run, `docker-compose run --rm bats_bash32`, in CI job `standalone_completion_bash32`.

**`docs/agents/folder-structure.md`** (line 104): add `client-completion.md` (bash completion reference) to the `standalone/` sub-docs row.

## Files to Change

- `docs/agents/standalone.md`: command list, `completion` summary, sync-rule pointer, out-of-scope, installer note, testing row.
- `docs/agents/folder-structure.md`: list the new sub-doc.
