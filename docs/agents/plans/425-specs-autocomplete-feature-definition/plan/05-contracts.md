# contracts.md

Create `docs/agents/specs/auto-complete/contracts.md`: the stable contracts, which can't change after the release that ships them. Model it on `client-update`'s stable-contracts section in `docs/agents/standalone/client-update.md`.

- **`kerghan completion bash`:** every later client accepts it. Users put `eval "$(kerghan completion bash)"` in rc files. The script's content may change freely.
- **`_kerghan`:** the function name is stable, because aliases rely on `complete -F _kerghan <name>`.
- **`KERGHAN_COMPLETION`:** joins the installer interface documented in the `install.sh` header. Every later installer respects `false`.
- **The completion file path:** as in `install.md`. The zsh/fish Epics and any future uninstaller rely on it.
- **The installer's `update` contract is unchanged:** completion adds no prompt, no sudo, and no fatal failure.
- **Sync rule:** any PR that adds or changes a client command, flag, `configure` key or fixed value updates the completion in the same PR.
  - Open marker → #426: how the rule is enforced.
  - #431 folds the rule into the permanent docs.
- **Required tests:** a behaviour list (the `completion bash` command name and `_kerghan` exist; `KERGHAN_COMPLETION=false` is honoured). Open marker → #428.

## Files to Change
- `docs/agents/specs/auto-complete/contracts.md` — new.
