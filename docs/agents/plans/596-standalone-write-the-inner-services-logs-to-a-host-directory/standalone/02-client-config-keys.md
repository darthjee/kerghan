# Client: `file-logs` and `log-dir` config keys

Add the two keys to `standalone/bin/kerghan`, following every existing per-key touch point
(file:line references are from the exploration on `main` at cfc1751):

- **Defaults** (:58-67): `DEFAULT_FILE_LOGS=true`. `DEFAULT_LOG_DIR` is derived as
  `$KERGHAN_HOME/logs`, like `bind`'s derived default.
- **`CFG_*` globals** (:81-88, and reset in `load_config` :337-344): `CFG_FILE_LOGS` and
  `CFG_LOG_DIR`.
- **Value sets** (:227-230): `FILE_LOGS_VALUES="true false"`. `log-dir` goes into
  `FREE_FORM_KEYS` (the completion sync test requires exactly one of the two).
- **Validator:** a new `valid_log_dir`. It accepts values starting with `/` or `~/`, and refuses:
  - empty values (handled by the usual empty-means-default rule in the file, and `--unset` in
    `configure`);
  - relative paths;
  - any `:` (it would break `-v SRC:DST`);
  - any whitespace, kept simple to stay safe;
  - `#`, which is already refused by the parser and `configure`.
  `file-logs` uses `valid_bool`.
- **`load_config` `case`** (:366-402): both keys, with `config_invalid` messages. For `log-dir`
  the expected text is `an absolute path or ~/path, without ':' or spaces`.
- **`CONFIG_KEYS`** (:718): add `file-logs log-dir` after `restart-on-update`, or wherever reads
  best. This list drives listing, batch validation, completion and the "known keys" errors.
- **`valid_config_value`** (:765-777), **`config_expected`** (:780-791), **`config_default`**
  (:795-805): `file-logs` → `true`. `log-dir` shows the derived default in `setting_lookup`'s
  derived case (:1088-1117), like `bind`.
- **`setting_display`** (:1333-1353): show the resolved `log-dir`, or `(default: ~/.kerghan/logs)`,
  matching the existing style.
- **`batch_apply_hint`** (:1620-1647): both keys fall into the "Run `kerghan up` to apply
  (recreates…)" branch with no special case. Confirm that.
- **`is_bool_key`** (:3010-3012): add `file-logs`.
- **Wizard:** `wizard_config_default` (:3374-3392) and `wizard_questions` (:3499-3562). Ask both
  keys as **advanced-only** (`wizard_asks_config <key> "$advanced"`), after `restart-on-update`.
  Ask `log-dir` only when `file-logs` is true.
- **Completion** (:2306-2309): `file-logs) values=(true false)`.
- **Help text `usage`** (:130-145): describe both keys, and add `file-logs` and `log-dir` to the
  "a changed … recreates the instance" sentence.
- **Header comment** (:9-13): list the new settings.

Expanding `~/` is done once, in a helper `resolved_log_dir` (`~/x` → `$HOME/x`; empty → default).
Step 03 uses it, and the later `kerghan diagnose` sub-issue will too (shared contract).

## Files to Change

- `standalone/bin/kerghan`: everything listed above.
