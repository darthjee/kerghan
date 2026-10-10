# Config loader and resolution

Add the parsing and resolution of `~/.kerghan/config` to `standalone/bin/kerghan`.

- `CONFIG_FILE="$KERGHAN_HOME/config"` next to `ENV_FILE`; defaults as constants
  (`DEFAULT_PORT=3000`, `DEFAULT_VARIANT=online`, `DEFAULT_RUNTIME=auto`,
  `DEFAULT_STOP_TIMEOUT=60`, image tag default = `KERGHAN_VERSION`).
- `load_config`: sets globals `CFG_PORT`, `CFG_VARIANT`, `CFG_RUNTIME`, `CFG_STOP_TIMEOUT`,
  `CFG_IMAGE_TAG` (empty = unset). Missing file → all empty, no message. Read line by line with
  `while IFS= read -r line || [ -n "$line" ]` (handles a missing trailing newline), counting
  line numbers:
  - strip a trailing `#` comment and surrounding whitespace; skip blank lines;
  - no `=` → `error "$CONFIG_FILE:<n>: expected key=value"`, exit 1;
  - split on the first `=`, trim key and value;
  - known key with a non-empty invalid value → `error "$CONFIG_FILE:<n>: invalid <key> '<value>' (expected ...)"`,
    exit 1. Validation: `port` via `valid_port`; `variant` ∈ online|offline; `runtime` ∈
    auto|sysbox|privileged; `stop-timeout` a positive integer; `image-tag` a valid Docker tag
    charset (`[A-Za-z0-9_.-]`, not starting with `.` or `-`, ≤128 chars) and must not itself end
    in `-offline` (the variant adds that);
  - unknown key → `warn "$CONFIG_FILE:<n>: unknown key '<key>' (ignored)"`, continue;
  - empty value → leave unset (default applies).
- Resolution in `cmd_up`: start from defaults, overlay config, overlay flags. `--offline` forces
  offline; otherwise `variant=offline` selects it. `-p` wins over `port=`. Call `load_config`
  before any side effect (before the refuse check and `ensure_env_file`).
- Helpers `effective_runtime` / `effective_stop_timeout` (config or default) for later steps.

## Files to Change
- `standalone/bin/kerghan` — `CONFIG_FILE`, defaults, `load_config`, validation helpers, resolution in `cmd_up`.
