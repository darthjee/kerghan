# Summary, confirmation and write

After the last question, nothing has been written yet.

- **Preview:** compute the change list *before* writing, using `key_changes <i>` and
  `setting_display` for the old value. The new value is the batch value: the `(default)`
  form is not needed, because the wizard only sets values. A secret prints `<KEY>: changed`,
  and a generated password prints `<KEY>: changed (generated)`. Never print the value itself.
  Keep this preview in a helper that reuses the masking rule from `batch_report`
  (`is_secret_key`), so the formats can't drift.
- **No change at all:** print `Nothing changed.` and exit `0` without asking.
- **Confirmation:** otherwise print the list, then `Write these changes? [Y/n]` on stderr.
  - Enter, `y` or `yes` (any case): run `batch_validate false || exit 1`, then
    `batch_apply || exit 1`, then print the apply hint, the password note and
    `cross_key_warnings`. Reuse `batch_report` for those, either by not printing its change
    list a second time (split out a helper from `batch_report` that prints only the hint and
    the warnings), or by not printing the preview list again.
  - After a generated password, also say that the new password is in
    `~/.kerghan/kerghan.env`.
  - `n` / `no`: print `Nothing written.` and exit `0`.
  - Anything else: ask again.
  - End of input: same as the other prompts (exit `1`, nothing written).
- **Usage:** add the verbatim line from wizard.md to `usage`, after the `configure` lines:
  `  wizard [--advanced]             set up the settings interactively (--advanced asks every setting)`.
- The wizard never calls `vault` and never runs `up`. The only Docker call is `volume_exists`.

## Files to Change
- `standalone/bin/kerghan` — preview helper, confirmation, hint-only split of `batch_report`
  (with `cmd_configure` output unchanged), `usage` line.
