# Issue: Performance: prefer parameter expansion over sed in bin/deploy_frontend.sh

## Description
Codacy (ShellCheck `SC2001`) flags `bin/deploy_frontend.sh:21`, in `run_generate_ssh_key_file()`, for using `sed` to perform a simple string substitution that bash can do natively via parameter expansion.

## Problem
`run_generate_ssh_key_file()` writes the deploy SSH private key to disk with:

```bash
echo "$SSH_PRIVATE_KEY" | sed -e "s/\\n/\n/g" > "$SSH_KEY_FILE_PATH"
```

This spawns an external `sed` process just to replace literal `\n` escape sequences (as stored in the `SSH_PRIVATE_KEY` env var) with real newlines — a simple substitution bash can do on its own without forking a subprocess.

## Expected Behavior
The literal `\n` sequences in `SSH_PRIVATE_KEY` are converted to real newlines using bash parameter expansion (`${variable//search/replace}`) instead of piping through `sed`, and the resulting `$SSH_KEY_FILE_PATH` file content is byte-for-byte unchanged from today's behavior.

## Solution
Replace line 21 with a parameter-expansion equivalent, e.g.:

```bash
printf '%s\n' "${SSH_PRIVATE_KEY//\\n/$'\n'}" > "$SSH_KEY_FILE_PATH"
```

(or another construct that preserves the current output exactly). Verify with `bash -n bin/deploy_frontend.sh` and, where feasible, a manual comparison of the generated key file against the current `sed`-based output.

## Benefits
Avoids spawning an external process for a trivial in-string replacement, resolving the ShellCheck `SC2001` finding and keeping the script slightly leaner.
