# Parser and shared config helpers

Teach the client the new key, following the conventions of the existing keys:

- Add a `DEFAULT_RESTART_ON_UPDATE=ask` constant next to the other `DEFAULT_*` constants.
- Add `valid_restart_on_update <value>` next to the other validators: accepts exactly `ask`, `always` and `never` (lower-case, no extra normalisation).
- `load_config`: reset a new `CFG_RESTART_ON_UPDATE=""` global with the others, and add a `restart-on-update)` case: `[ -z "$value" ] || valid_restart_on_update "$value" || config_invalid "$n" "$key" "$value" "ask, always or never"`, then store the value. The error reads `.../config:<n>: invalid restart-on-update 'yes' (expected ask, always or never)`.
- `CONFIG_KEYS`: append `restart-on-update` after `bind` → `port variant runtime stop-timeout image-tag auto-login bind restart-on-update`.
- `valid_config_value`: `restart-on-update) valid_restart_on_update "$2" ;;`.
- `config_expected`: `restart-on-update) echo "ask, always or never" ;;`.
- `config_default`: `restart-on-update) echo "$DEFAULT_RESTART_ON_UPDATE" ;;`.
- Check `setting_lookup`'s fallback branch (after the `auto-login` / `bind` special cases) uses `config_default`, so an unset key lists as `ask` with source `default`; `wizard_config_default` must likewise fall back to `config_default` for this key. Add a case if either does not.

With these in place, the `configure` listing (row after `bind`, source `file` / `default` / `file, invalid`), single read, set (validated, invalid refused with exit 1) and `--unset` need no special case — verify that, don't add one.

## Files to Change
- `standalone/bin/kerghan` — constant, validator, `load_config`, `CONFIG_KEYS`, `valid_config_value`, `config_expected`, `config_default` (and the default fallbacks if needed).
