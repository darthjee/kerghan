# completion.md: word-list sources

Replace the `> **Open — settled by #426:**` block under `### Word lists` in `docs/agents/specs/auto-complete/completion.md` with the decision.

- **Source table**, one row per list:

  | List | Source |
  |---|---|
  | config keys | generated from `CONFIG_KEYS` |
  | env keys | generated from `DEFAULT_ENV_KEYS` plus the `FRONTEND_BASE_URL` constant (#434) |
  | fixed values | generated from the four value constants (#434) |
  | commands | hand-written in `_kerghan` |
  | per-command flags | hand-written in `_kerghan` |

  Give a one-line reason per row. Commands and flags are hand-written because a `case` pattern can't take its alternatives from a variable.
- **What "generated" means:** `kerghan completion bash` prints the lists from the client's own constants. The script stays fixed text for a given client version (link to [security.md](security.md#fixed-text)).
- **Rejected alternatives,** each with its reason: generating everything, and hand-writing everything.
- **Derived list:** the `--unset` list (config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`) is derived from the same lists, never kept separately.
- **Words outside the lists,** as short rules:
  - Hidden words (`--finish`) live in one commented exclusion list.
  - Aliases (`-p`/`--port`, `help`/`-h`/`--help`) are plain words in the lists; grouping them is the per-position table's job (#427).
  - `--[no-]x` pairs are stored as both expanded words.
  - `CLIENT_MANAGED_KEYS` are never offered.
  - Positional arguments (`compose <args>`, `update [VERSION]`, a bare `configure KEY`) aren't list entries; see [Never completed](#never-completed).
  - Every config key is either free-form (`FREE_FORM_KEYS`: `port`, `bind`, `image-tag`, `stop-timeout`) or has a value list, never both and never neither.
- Under `## Required tests`, add the three sync checks, saying what each one checks:
  - **Generated lists:** with the client sourced, completion offers exactly `CONFIG_KEYS`, `DEFAULT_ENV_KEYS` plus the `FRONTEND_BASE_URL` constant, and each value constant.
  - **Hand-written lists:** the `kerghan help` cross-check covers commands and synopsis flags, with `--[no-]x` expanded, aliases counted, and the exclusion list skipped.
  - **Classification:** every `CONFIG_KEYS` entry is either in `FREE_FORM_KEYS` or has a value constant.
  - In all three, a failure names the word and the side it's missing from, and the lists are compared as sets.

Leave the `### Per-position table` marker (#427) and the `#428` marker untouched.

## Files to Change
- `docs/agents/specs/auto-complete/completion.md` — replace the `#426` marker under `### Word lists` with the decision, and extend `## Required tests`.
