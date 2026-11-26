# Help, dispatch, completion and the `up` hint

Wire the command into the client's surfaces.

- **`usage`**: add, after `status`,
  `diagnose                        check the instance end to end (read-only)` (aligned with the
  other entries).
- **`main`**: add `diagnose) cmd_diagnose ${@+"$@"} ;;`.
- **Completion** (`completion_bash_script`): add `diagnose` to the first-word list in `_kerghan`
  (`up down logs status compose ...`). It takes no arguments, so it offers nothing after it, like
  `status`. Keep the script bash 3.2-safe and within the `completion_safety.bats` rules.
- **`warn_port_conflict`**: add a last line, `hint "run 'kerghan diagnose' for details"`, after the
  `-p` hint and the AirPlay hint.

## Files to Change

- `standalone/bin/kerghan`: `usage`, `main`, `completion_bash_script`, `warn_port_conflict`.
