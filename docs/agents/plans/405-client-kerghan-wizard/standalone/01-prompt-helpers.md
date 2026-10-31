# Prompt helpers

Add the small helpers the wizard needs, next to `read_hidden_value`. Every prompt goes to
stderr and every answer is read from stdin.

- `wizard_read <prompt>`: prints `<prompt>: ` to stderr and reads one line into a global
  (e.g. `WIZARD_ANSWER`). At end of input it prints the "input ended" error, says nothing was
  written, and exits `1`.
- `wizard_ask <key> <label> <bracket-text>`: the loop for one config or env question. It
  prompts `<label> [<bracket-text>]`. An empty answer returns "keep" (Enter is never invalid).
  A boolean key (`auto-login`, `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN`)
  maps `y`/`n` to `true`/`false`. Any other answer is checked with `validate_value`. On failure
  the validator message is already on stderr, so the helper asks the same question again.
- The invalid-current-value prompt shape is `Port [3000] (current value 'abc' is invalid):`,
  and Enter then means "write the default".
- `wizard_password`: implements the `(k)eep, (g)enerate or (t)ype? [k]` prompt.
  - When `kerghan.env` has no password, `keep` is not offered and the default is `g`.
  - `g` returns a value from `default_env_value KERGHAN_DEFAULT_USER_PASSWORD` plus a
    "generated" flag. The value is never printed.
  - `t` asks twice with `stty -echo`, using the same prompt pair and Ctrl-C trap as
    `read_hidden_value`, but always interactive. A mismatch says so and asks both again. A
    value shorter than `PASSWORD_MIN_LENGTH` is asked again; never echo the value in an error.
  - Any other answer asks again.
- Ctrl-C: install one `INT` trap for the whole wizard that restores `stty echo` and exits
  `130`. Nothing has been written at that point, because the batch only lives in memory.

## Files to Change
- `standalone/bin/kerghan` — new helper functions with header comments in the style of the
  surrounding code.
