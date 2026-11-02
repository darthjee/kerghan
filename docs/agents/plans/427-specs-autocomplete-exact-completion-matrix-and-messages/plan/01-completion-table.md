# completion.md: per-position table and registration

## Registration

- Change the registration to `complete -o nospace -F _kerghan kerghan`. `-o nospace` is the only option allowed; `-o default`, `-o bashdefault` and `-o filenames` stay forbidden.
- Add the trailing-space rule: `_kerghan` adds a trailing space to every candidate except `KEY=` candidates (`port=`, `KERGHAN_SECRET_KEY=`, …), because bash 3.2 has no `compopt`. When a single candidate remains, bash inserts it as is, so the space must already be part of the word.
- **Edge case 13:** replace "how it is met … is left to the per-position table and #429" with a link to this rule.
- **Edge case 2:** the manual alias line becomes `complete -o nospace -F _kerghan <name>`. Without `-o nospace`, `KEY=` would get a space after it.

## `### Per-position table`

Replace the Open marker with the table. Key each row by command and context. The context is the previous word, the current word's `KEY=` prefix (rebuilt across the `=` word break), or a word position. Cover:

- **Top level** (first word after `kerghan`): every command name plus `help`, `-h` and `--help`.
- **`up`:**
  - Offer `--offline`, `-p`/`--port`, `--auto-login`/`--no-auto-login`, `--bind` and `-f`, minus the words already on the line.
  - `-p` and `--port` count as one.
  - The auto-login pair is mutually exclusive.
  - After `-p`, `--port` or `--bind`: nothing, and that word is never parsed as a flag.
- **`logs`:** `-f` if it isn't on the line; nothing otherwise.
- **`update`:**
  - Offer `--force`, `--yes`, `--restart` and `--no-restart`, minus the words already on the line, with the restart pair mutually exclusive.
  - A `VERSION` already typed doesn't change the offer; versions are never offered.
  - Never offer `--finish`.
- **`configure`:**
  - **Flags:** `--show-secrets`, `--force` and `--unset`, with repeats filtered except `--unset`.
  - **Keys:** config keys and env keys as `KEY=` (no trailing space), minus keys already on the line.
  - **After `KEY=`:** the fixed values for `variant`, `runtime`, `auto-login` and `restart-on-update` (with a trailing space). Nothing for free-form keys, env keys or `KEY=-`.
  - **After `--unset`:** bare names (with a trailing space) of the config keys and `FRONTEND_BASE_URL`, minus keys already on the line. Never the `DEFAULT_ENV_KEYS` names.
  - **Combination rules:**
    - a write (`KEY=…`, `KEY=-`, `--unset KEY`) or `--force` on the line hides `--show-secrets`;
    - `--show-secrets` hides `--force`, `--unset` and every `KEY=`.
  - A bare `KEY` (read one setting) is never offered.
- **`wizard`:** `--advanced` if it isn't on the line.
- **`completion`:** `bash` at the first argument position, nothing after it.
- **`down`, `status`, `compose`, `reset`, `update-env`, `version`, `help`:** nothing at any position.
- **Unknown command:** nothing.

Under the table, map each edge case 4–17 to its row or rule, so none is left implicit. Also state that "on the line" means the words other than the current one.

## Per command

Update the `configure` row's link if needed, so "Per command" and the table don't disagree. The table is the exact source, and "Per command" stays the summary.

## Required tests

Add:

- Every candidate except `KEY=` ends with a space; `KEY=` candidates don't.
- The registration uses `-o nospace` and no other option.
- `configure variant=x <TAB>` doesn't offer `--show-secrets`; `configure --show-secrets <TAB>` offers no `KEY=`, `--force` or `--unset`; `configure --force <TAB>` doesn't offer `--show-secrets`.
- `completion <TAB>` offers `bash`; `completion bash <TAB>` offers nothing.
- `wizard --advanced <TAB>` and `logs -f <TAB>` offer nothing.

## Files to Change
- `docs/agents/specs/auto-complete/completion.md` — Registration, edge cases 2 and 13, the per-position table replacing the Open marker, Required tests.
