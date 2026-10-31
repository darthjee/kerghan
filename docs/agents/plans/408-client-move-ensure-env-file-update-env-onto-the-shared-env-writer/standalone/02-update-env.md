# update-env on the writer
In `cmd_update_env`, replace the `{ … } >>"$ENV_FILE"` block and the `chmod 600` with:

1. Read the existing file byte for byte, keeping trailing newlines (e.g.
   `old="$(cat "$ENV_FILE"; printf x)"; old="${old%x}"` — plain `$(cat)` strips them).
2. Build `new="$old"`, adding `$'\n'` when `old` is non-empty and does not end with a newline
   (today's `[ -s ] && tail -c1` rule), then append `$content` plus a final newline.
3. `write_file_atomic "$ENV_FILE" "$new" 600 || exit 1`.

Everything before (missing/blank detection, warnings, hint, "up to date" path) and the messages
after a successful write stay exactly as they are. Update the function comment to mention the
atomic write.

## Files to Change
- `standalone/bin/kerghan` — `cmd_update_env` write block and comment.
