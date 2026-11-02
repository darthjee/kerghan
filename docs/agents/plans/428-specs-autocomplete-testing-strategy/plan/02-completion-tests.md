# completion.md Required tests

Rewrite `completion.md`'s `## Required tests` as concrete cases and remove its `Open — settled by #428` marker. Keep every existing requirement; each becomes one or more cases.

**Shape.** Group the cases by target file, one table each:

- `completion.bats`: the matrix rows, edge cases, registration and dual `=` shapes;
- `completion_sync.bats`: the three sync checks;
- `completion_safety.bats`: only the read-no-file case that lives here, linked to [security.md](security.md#required-tests).

Columns: `Label` (`matrix <label>`, `edge <n>` or `contract <name>`), `Input` (the line given to `complete_line`, or the words given to `complete_words`), and `Expected` (the exact `COMPREPLY`, each word in backticks with its trailing space visible, e.g. `` `up ` ``, or "nothing").

**Cases to include, at least:**

- **Registration** (`contract _kerghan`): `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan`.
- **`top-first`:** `kerghan ` offers all 15 words, each with a trailing space. `kerghan co` offers `compose `, `completion ` and `configure `.
- **`top-later` / edge 4:** `kerghan foo ` and `kerghan -h ` offer nothing.
- **`up-flags`, `logs`, `update`, `wizard`, `completion-first`, `completion-later` and `no-args`:** one case per row with the full list, and one with a flag already on the line. Edges 9 and 10 cover `-p` hiding `--port` and the mutually exclusive pairs. `update 0.9.0 ` still offers the flags (edge 7), and nothing ever offers `--finish ` (edge 11).
- **`up-flag-arg` / edge 8:** `kerghan up -p `, `kerghan up --port ` and `kerghan up --bind ` offer nothing. `kerghan up -p 8080 ` offers the `up` flags minus `-p ` and `--port `.
- **`cfg-other`:**
  - `kerghan configure ` offers `--show-secrets `, `--force ` and `--unset `, every config key as `KEY=` and every env key as `KEY=`, with no space after a `=`.
  - It never offers a bare key.
  - `configure port=- ` still offers the other `KEY=` words (edge 16 / 17).
  - `configure variant=x ` and `configure --force ` drop `--show-secrets ` while `--unset ` stays.
- **`cfg-value` / edge 13:**
  - Each fixed key with its values, in each `=` shape: words `(… variant =)`, `(… variant = '')` and `(… variant = on)` give `online ` and `offline `, or `online ` alone for the `on` shape.
  - Repeat for `runtime`, `auto-login` and `restart-on-update`.
- **`cfg-free` / edge 16:** `port=`, `bind=`, `image-tag=`, `stop-timeout=`, an env `KEY=` and `KEY=-` offer nothing, in the `=` shapes.
- **`cfg-unset` / edge 14:**
  - `configure --unset ` offers the config keys and `FRONTEND_BASE_URL `, bare, and no `DEFAULT_ENV_KEYS` name.
  - `configure --unset port --unset ` drops `port `.
  - `configure --unset port ` keeps `--unset ` offered.
- **`cfg-show-secrets`:** `configure --show-secrets ` offers nothing.
- **Edge 1:** words `(./kerghan …)` complete the same as `(kerghan …)`.
- **Edges 3 and 15:** point to [security.md](security.md#required-tests) and the bash 3.2 service. Do not duplicate them.
- **Edge 12:** `kerghan up ` never offers `help `, `-h ` or `--help `.
- **No filename fallback:** in a temp `PWD` holding a file `upfile`, `kerghan up` offers no `upfile`.
- **Sync** (`completion_sync.bats`): the three checks from the issue's "Sync check" section, each with its inputs and the form of its failure message (`--bind: in usage, not in completion`). Add the explicit exclusion list (`--finish`) and the `FREE_FORM_KEYS` list as the test holds them.

Close with one sentence: every case runs in both bash services (the glob), and every label has at least one case.

## Files to Change
- `docs/agents/specs/auto-complete/completion.md` — `## Required tests` rewritten as concrete cases; the #428 marker removed.
