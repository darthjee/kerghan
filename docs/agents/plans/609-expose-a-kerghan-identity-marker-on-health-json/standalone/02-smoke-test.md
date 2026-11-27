# Assert the marker in the smoke test

`standalone/scripts/smoke_test.sh` waits on `wait_for_200 "$BASE_URL/health.json"` (first boot, line ~197, and after the restart, line ~231). Keep both waits as they are (they stay a liveness gate). After the first wait succeeds, fetch the body once and assert:

- the whitespace-stripped body contains `"app":"kerghan"`;
- it contains a non-empty `"version":"<semver>"`, and when the script knows the expected image version (for example from the `IMAGE` tag, if it is a semver tag), that it matches. Otherwise only assert the semver shape.

On a mismatch, `fail` with a message that prints the body (the body is Kerghan's own, so it is safe to print here). Update the script's header comment to mention the identity check, and the final `OK:` log line if useful.

## Files to Change

- `standalone/scripts/smoke_test.sh` — body assertion after the first `/health.json` wait, header comment
