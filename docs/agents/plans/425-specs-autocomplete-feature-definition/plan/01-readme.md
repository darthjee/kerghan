# README.md

Create `docs/agents/specs/auto-complete/README.md`, the feature's entry point:

- **Overview and purpose:** bash tab completion for the `kerghan` client, delivered by `kerghan completion bash` and set up by `install.sh`.
- **Product decision:** #424.
- **Scope:**
  - In: bash; commands, flags, `configure` keys (config keys and `DEFAULT_ENV_KEYS` names), and fixed values (`variant`, `runtime`, `auto-login`, `restart-on-update`).
  - Out: `update` versions, `compose`/`logs` passthrough, the `vault` CLI, dynamic lookups, Windows/PowerShell, uninstall.
- **Follow-up Epics:** zsh and fish. The `kerghan completion <shell>` argument keeps them possible.
- **Decisions summary:** one bullet per file.
- **Index:** linking every other file, with a "who reads what" line (#429: command, completion, contracts, security; #430: install, contracts, security; #431: all).
- **Open markers:** a list of every open marker across the files, with the sub-issue that settles each one (#426, #427, #428).
- **Sub-issue order:** #425 → #426 → #427 → #428 → #429 → #430 → #431.

No "Required tests" section in `README.md`.

## Files to Change
- `docs/agents/specs/auto-complete/README.md` — new.
