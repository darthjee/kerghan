# `configure` apply hint

`restart-on-update` applies to the next `kerghan update`, not to the running instance. In `batch_apply_hint`, track whether any changed key other than `restart-on-update` exists:

- If the **only** changed key(s) are `restart-on-update`, print `Takes effect on the next 'kerghan update'.` instead of either `kerghan up` hint.
- Otherwise keep today's logic: the strongest hint among the other changed keys (`down && up` beats `up`), and do not print the `kerghan update` line. `restart-on-update` alone must not force either existing hint.
- The password note and `cross_key_warnings` stay as they are.

The wizard reuses the same batch report, so it gets the same hint for free.

## Files to Change
- `standalone/bin/kerghan` — `batch_apply_hint`.
