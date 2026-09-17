# Infra Plan: Performance: prefer parameter expansion over sed in bin/deploy_frontend.sh

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Replace sed with parameter expansion in run_generate_ssh_key_file
`run_generate_ssh_key_file()` in `bin/deploy_frontend.sh` currently does:

```bash
echo "$SSH_PRIVATE_KEY" | sed -e "s/\\n/\n/g" > "$SSH_KEY_FILE_PATH"
```

This forks an external `sed` process to replace literal `\n` escape sequences (as stored in the `SSH_PRIVATE_KEY` CI secret) with real newlines — flagged by Codacy/ShellCheck `SC2001`. Replace it with a bash parameter-expansion equivalent that keeps the output byte-for-byte identical, e.g.:

```bash
printf '%s\n' "${SSH_PRIVATE_KEY//\\n/$'\n'}" > "$SSH_KEY_FILE_PATH"
```

Keep the existing `chmod 600 "$SSH_KEY_FILE_PATH"` line right after it unchanged.

Verify with `bash -n bin/deploy_frontend.sh` for syntax, and manually compare output for a sample key value containing `\n` sequences (e.g. `SSH_PRIVATE_KEY=$'line1\\nline2'` fed through both the old and new commands) to confirm identical resulting file content.

## Files to Change
- `bin/deploy_frontend.sh` — replace the `sed` pipe on line 21 with parameter expansion in `run_generate_ssh_key_file()`.

## Notes
- No local unit tests exist for this script; verification is via `bash -n` plus a manual before/after comparison of the generated key file, since the real path (CircleCI `generate_key_file` job) requires the `SSH_PRIVATE_KEY` secret and isn't runnable locally end-to-end.
