# Bats tests

Cover the spec's "Required tests" in the existing files under `standalone/test/`:

- **`config.bats` (parser):** `ask`, `always`, `never` accepted; empty value and missing line use `ask`; `yes`, `Always`, `true` make `load_config` fail with exit `1` and `(expected ask, always or never)`.
- **`configure.bats` / `configure_files.bats`:**
  - listing row after `bind` with source `default`, `file` and `file, invalid`;
  - single read prints the file value, or an empty line when unset;
  - each valid value is written; an invalid one exits `1` with nothing written; `--unset restart-on-update` removes the line;
  - apply hint: only `restart-on-update` changed → `Takes effect on the next 'kerghan update'.`; together with `port` → the `kerghan up` hint instead;
  - update any existing listing assertions that enumerate every config key (the new row / `CONFIG_KEYS` list in error messages such as unknown-key hints).
- **`wizard.bats`:** every existing answer sequence gains one Enter line after the `bind` answer. New cases: question asked right after `bind` with and without `--advanced`; Enter keeps the current value and writes nothing when unset; an invalid answer is re-asked; an invalid current line is offered as `[ask]` and fixed by Enter; `y` is refused, not translated.
- **Usage:** `kerghan help` lists `restart-on-update=ask` with its description (existing usage tests, e.g. `args.bats`).
- **`config.example`:** contains `#restart-on-update=ask` (wherever `config.example` is already asserted, or a new case in `config.bats`).

Run the suite with `docker-compose run --rm standalone_tests`.

## Files to Change
- `standalone/test/config.bats` — parser cases (and `config.example` check if it fits there).
- `standalone/test/configure.bats` — listing, read, set, unset, apply hint.
- `standalone/test/configure_files.bats` — file-level write/unset assertions as the existing keys do.
- `standalone/test/wizard.bats` — extra Enter in every sequence, new question cases.
- `standalone/test/args.bats` (or wherever usage is asserted) — usage line.
