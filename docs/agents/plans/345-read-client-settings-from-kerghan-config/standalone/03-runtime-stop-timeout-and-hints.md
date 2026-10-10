# Pass runtime and stop-timeout to Vault; hints and help

- `up_instance`: add `--runtime <runtime>` and `--stop-timeout <seconds>` to the `vault up` args
  (always pass the resolved values, defaults included, so the call is explicit and testable).
- Every `down`: `cmd_down`, the recreate `vault_cmd down` in `cmd_up`, and `cmd_reset` pass
  `--stop-timeout <seconds>`. `cmd_down` and `cmd_reset` call `load_config` first (a malformed
  config fails them before any `vault` call; in `reset`, validate before the confirmation prompt).
- Port-in-use hint: `use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port`.
- `usage`: mention `~/.kerghan/config` (settings: port, variant, runtime, stop-timeout,
  image-tag; flags override it) and that runtime/stop-timeout changes apply the next time the
  container is created (`kerghan down && kerghan up`).
- Update the header comment to mention `~/.kerghan/config`.

## Files to Change
- `standalone/bin/kerghan` — `up_instance`, `cmd_up`, `cmd_down`, `cmd_reset`, the port hint, `usage`, header.
