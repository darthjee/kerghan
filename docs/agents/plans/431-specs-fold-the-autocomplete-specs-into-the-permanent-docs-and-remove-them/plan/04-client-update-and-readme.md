# client-update.md installer interface and README

**`docs/agents/standalone/client-update.md` → "Installer interface"** (around line 984):

- Behaviour bullet: change "exits non-zero on any failure" to "exits non-zero on any failure of the client or `vault` install; the bash completion step only warns (see [Client completion](client-completion.md#…never-fatal anchor))".
- Add a bullet: `update` does not pass `KERGHAN_COMPLETION`, so the completion step runs on updates unless the user exported `KERGHAN_COMPLETION=false`.
- "No installer addition is needed" stays true: completion is an additive installer feature `update` never relies on. Say so in one line.

**`README.md` → "Run Kerghan standalone" → "Install":** add a short paragraph or sub-heading on bash completion:

- the installer sets it up automatically: with the `bash-completion` package it loads on the first `kerghan <TAB>`;
- without the package, add the `source "<file>"` line the installer prints to `~/.bashrc`, or use `eval "$(kerghan completion bash)"`;
- opt out with `KERGHAN_COMPLETION=false`;
- the file path, with a link to `docs/agents/standalone/client-completion.md`.

Also add `client-completion.md` next to the existing client-config/client-update links in the README's Configuration paragraph, if that fits naturally.

Check that the `install.sh` header needs no rewording: #430 already did it. Its link stays `docs/agents/standalone/client-update.md#stable-contracts`.

## Files to Change

- `docs/agents/standalone/client-update.md`: installer interface exit rule and `KERGHAN_COMPLETION` note.
- `README.md`: completion enable and opt-out instructions.
