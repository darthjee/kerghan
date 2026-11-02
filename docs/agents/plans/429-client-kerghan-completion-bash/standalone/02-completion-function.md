# The `_kerghan` completion function

Write the script that the generator prints, as in `docs/agents/specs/auto-complete/completion.md` and `security.md`.

- **Registration:** define `_kerghan` (helpers only as `_kerghan_*` functions) and end with exactly `complete -o nospace -F _kerghan kerghan`. Never use `-o default`, `-o bashdefault` or `-o filenames`.
- **Behaviour:** implement the per-position table and every numbered edge case exactly:
  - top level, then each command's flags and flag arguments;
  - `configure` keys as `KEY=`, fixed values after `=`, and `--unset` keys;
  - `--show-secrets`;
  - the "Never completed" cases: `compose` arguments, `update [VERSION]`, a bare `configure KEY`, the hidden `update --finish`, `CLIENT_MANAGED_KEYS`, and anything after `--`;
  - no filename fallback.
- **Trailing space:** append a space to every candidate except `KEY=` candidates. With `-o nospace`, bash adds none itself, so the space must already be part of the word in `COMPREPLY`.
- **`=` handling on both bash versions:** depending on the version and `COMP_WORDBREAKS`, `variant=on` reaches the function as words `(… variant = on)`, as `(… variant = '')` or as one word. Rebuild the `KEY=VALUE` context from `COMP_WORDS`/`COMP_CWORD` so every shape the spec names gives the specified reply. Use only `COMP_WORDS`/`COMP_CWORD`, never `COMP_LINE` parsing that would need a subprocess.
- **Lists:**
  - Generated lists are literal words that the generator prints into function bodies (local variables or `case`/`for` word lists). They are never globals.
  - The `--unset` list is the config keys plus `FRONTEND_BASE_URL`, built from the same generated words, never a separate copy.
  - Commands and per-command flags are hand-written. Keep one commented exclusion list for hidden words (`--finish`).
- **Safety rules** (they shape the code):
  - **bash 3.2 only:** no `compopt`, associative arrays, `${var,,}`, `mapfile`, `[[ -v ]]` or `local -n`; expand empty arrays as `${arr[@]+"${arr[@]}"}`.
  - **No subprocess and no file read on TAB:** no `$( )`, backticks, pipes, `<`/`>`/`<(`, `source`/`.`, `eval`, `read` or `exec`, and no `$HOME`, `~` or `.kerghan`. These are the static deny-list in `security.md`, applied to the whole script with comment lines removed. So filter prefixes with a `for` loop and `case "$w" in "$cur"*)`, not `COMPREPLY=($(compgen …))`. Avoid `|` in `case` patterns too (use separate arms); the deny-list would flag it.
  - **Hygiene:** declare every variable `local`, and change no `set -o`/`shopt` option and no `IFS`. If a narrower `IFS` is ever needed, make it `local`. Work under `set -u`: give every expansion of a possibly-unset `COMP_*` a default.
  - **No bash-completion helpers** (`_init_completion`, `_get_comp_words_by_ref`, …).
- If a denied token is genuinely unavoidable, stop and report it. The spec's exception process belongs to the spec folder, not this PR.

## Files to Change

- `standalone/bin/kerghan`: the script text the generator prints (`_kerghan`, the `_kerghan_*` helpers and the `complete` line).
