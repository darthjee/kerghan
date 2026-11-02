# `completion_command.bats` and existing usage tests

Write the cases from `command.md` → `## Required tests`, the contract cases from `contracts.md` → `## Required tests` that live in this file, and the `fixed text` case from `security.md` → `### Other files`.

- **`standalone/test/completion_command.bats`:**
  - `contract completion bash`: exit `0`, the script on stdout, stderr empty;
  - `contract _kerghan`: after sourcing, `_kerghan` is a function, and `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan`;
  - `contract complete -o nospace -F _kerghan kg`: after `complete -o nospace -F _kerghan kg`, the words `(kg '')`, `(kg up '')` and `(kg configure variant =)` give the same replies as with `kerghan`;
  - every error row: missing shell; `zsh`, `fish` and `Bash`; `-x` and `--help`; an extra argument; and both order-of-checks cases. Each expects exit `2`, empty stdout, and stderr equal to the exact first line followed by the full usage (compare against `"$KERGHAN" help`'s output);
  - `usage line`: `kerghan help` contains the exact `completion bash` line, after the `wizard` line and before the `version` line;
  - `no side effects`: take `find "$HOME"` before; after `kerghan completion bash`, `STUB_LOG` is empty, the `find` is unchanged and `~/.kerghan` doesn't exist;
  - `fixed text`: two runs with different `HOME`, `PWD`, `XDG_DATA_HOME` and `KERGHAN_*` values give byte-identical output.

  Capture stdout and stderr separately (e.g. redirect to files in `$BATS_TEST_TMPDIR`), since bats 1.11's `run` merges them unless `--separate-stderr` is used.
- **Existing tests:** update any bats test that compares the full usage text with the new line. Check `args.bats` (`help, -h and --help print the usage`) and every `usage` assertion found by `grep -rn usage standalone/test`.

## Files to Change

- `standalone/test/completion_command.bats`: new.
- `standalone/test/args.bats` (and any other file that compares the full usage text): updated with the new `usage` line.
