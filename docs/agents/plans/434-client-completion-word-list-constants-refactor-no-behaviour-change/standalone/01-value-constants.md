# Value constants, validators and messages

Add the four value constants and make the validators and every "expected …" message read them.

1. Near the validators (before `valid_variant`), add the constants with a short comment. The comment says each one is the fixed value set of its config key, that validation and messages read it, and that #429 completion generates from it:
   - `VARIANT_VALUES="online offline"`
   - `RUNTIME_VALUES="auto sysbox privileged"`
   - `AUTO_LOGIN_VALUES="true false"`
   - `RESTART_ON_UPDATE_VALUES="ask always never"`
2. Rewrite the validators with `in_list` instead of `case` patterns. `in_list` is defined later in the file (~line 565), but bash resolves functions when they are called, so only the call order matters. Moving `in_list` up next to the validators is fine if that reads better.
   - `valid_variant() { in_list "$1" "$VARIANT_VALUES"; }`
   - `valid_runtime() { in_list "$1" "$RUNTIME_VALUES"; }`
   - `valid_bool() { in_list "$1" "$AUTO_LOGIN_VALUES"; }`: also used for `KERGHAN_DEFAULT_USER_ENABLED` / `KERGHAN_DEFAULT_USER_ADMIN`, so say in a comment that those share it.
   - `valid_restart_on_update() { in_list "$1" "$RESTART_ON_UPDATE_VALUES"; }`
   - Guard against the empty string. `in_list "" "a b"` matches `*"  "*` only if the list holds a double space, and the constants never do, so `''` stays rejected. Keep it that way: no double spaces.
3. Add a join helper, e.g. `or_list <space-separated list>`. It prints the words with the last two joined by ` or ` and the rest by `, `: `online or offline`, `auto, sysbox or privileged`, `ask, always or never`, `true or false`. Use bash 3.2-safe constructs only (a `for` loop over the unquoted list, no arrays needed).
4. Build the messages from the constants:
   - `config_expected`: `variant`, `runtime`, `auto-login` and `restart-on-update` echo `$(or_list "$<CONST>")`.
   - `load_config`: the `config_invalid … "online or offline"` / `"auto, sysbox or privileged"` / `"true or false"` / `"ask, always or never"` calls pass `"$(config_expected <key>)"` (or `or_list` directly) instead of the literals.
   - The `configure` validator's env bool-key branch: `expected $(or_list "$AUTO_LOGIN_VALUES")`.
   - Update the `valid_restart_on_update` comment so it no longer repeats the values by hand, or points at the constant.
5. Check that the output is byte-identical: run the bats suite. Optionally also diff the output of a few invalid-value runs before and after.

## Files to Change
- `standalone/bin/kerghan` — the value constants, the `in_list`-based validators, the `or_list` helper, and the messages built from the constants.
