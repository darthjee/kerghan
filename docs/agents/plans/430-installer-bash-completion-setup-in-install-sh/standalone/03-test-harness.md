# Test harness: stub client, mv wrapper, env isolation

Extend the installer test harness so every Required test runs as root in CI, with nothing skipped.

- **Env isolation** in `helpers/install_setup.bash` `setup()`:
  - add `BASH_COMPLETION_USER_DIR XDG_DATA_HOME KERGHAN_COMPLETION` to the existing `unset` list, plus the new stub variables below;
  - `export KERGHAN_BASH_COMPLETION_PATHS="$TEST_ROOT/no-bash-completion"` (a path that doesn't exist), so the hint is deterministic and never depends on the container;
  - define `COMPLETION_FILE="$HOME/.local/share/bash-completion/completions/kerghan"` for the tests.
- **Configurable stub client** in `test/stubs/curl`, for the `*/releases/download/*/kerghan` branch:
  - keep the current default for any other arguments: print `fake kerghan <v>`, so `install.bats` is unchanged;
  - when the client is called with `completion bash`, it follows `STUB_CLIENT_COMPLETION`, read at run time from the client's environment:
    - `script` (default): print a fixed marker script, e.g. `# fake kerghan <v> completion` plus a `complete` line;
    - `missing`: exit `2` with empty stdout and a usage error on stderr;
    - `empty`: exit `0` with empty stdout;
    - `list`: first print the entries of the completion file's directory using bash globs (`for f in "$dir"/.* "$dir"/*`; the tools dir has no `ls`), then the script. The directory comes from `STUB_COMPLETION_DIR`, set by the test.
  - Document the new variables in the stub's header comment.
- **Failing `mv` wrapper:** a helper, e.g. `with_failing_completion_mv`, in `install_setup.bash`. It replaces the `mv` symlink in `$TOOLS_BIN` with a script that exits `1` when its last argument is the completion file. Otherwise it `exec`s the real `mv`, with its path captured in setup. This injects the write failure without chmod, so it works as root. A `mkdir` failure needs no wrapper: point `BASH_COMPLETION_USER_DIR` under a regular file (the `a-file/bin` trick).
- **Small asserts** if useful: e.g. `assert_completion_file <path>`, which checks a regular file holding the stub's marker script. Keep `install.bats` itself untouched.

## Files to Change
- `standalone/test/helpers/install_setup.bash` — env isolation, `COMPLETION_FILE`, the `mv` wrapper helper, and any new asserts.
- `standalone/test/stubs/curl` — `completion bash` modes in the fake client, plus the header comment.
