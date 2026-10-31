# `kerghan configure` command

Add `cmd_configure` on top of the writer, and wire it into `usage` and `main`.

- **Argument parsing** (`configure.md` "Usage"): options and arguments in any order; decide the
  form (list, single read, write) and reject every listed usage error with `usage_error`
  (exit `2`): unknown option, `--unset` without a key or with `KEY=VALUE` as its argument, more
  than one bare key, a bare key mixed with writes, `--show-secrets` with a write, `--force` with
  a list or read, the same key twice, more than one `KEY=-`, a malformed key. Split `KEY=VALUE`
  at the first `=`.
- **List**: two sections with aligned columns, rows in the order `configure.md` defines, the
  "not created yet" line when `kerghan.env` is missing, masking unless `--show-secrets`. Report
  a `config` line without `=` on stderr as a warning with its line number; the listing still
  prints. Creates no file.
- **Single read**: the raw effective value on one line; empty line (exit `0`) when unset;
  `******** (set)` for a set secret unless `--show-secrets`; unknown lower-case key exits `1`.
- **Write**: collect the batch, resolving each `KEY=-` before validation: on a TTY (`is_tty`)
  prompt `KEY: ` on stderr with echo off (`stty -echo`, restored by a trap; ignore `stty`
  failures so `KERGHAN_ASSUME_TTY` works on a pipe), ask again to confirm, repeat both on a
  mismatch, Ctrl-C exits `130` with nothing written; from a pipe read the first line of stdin
  without its newline. Print the inline-secret hint on stderr for a secret key given as
  `KEY=value` (never stops the write). For `--force` on a secret: print the warning on stderr,
  then on a TTY ask `Continue? [y/N]` (anything but `y`/`yes` exits `1`, nothing written).
  Then validate the batch, apply it and print the report.
- **No Docker beyond the volume check, never `vault`**, never recreate the instance.
- **`usage`**: add the two `configure` lines verbatim from `configure.md`, after `update-env`.
- **`main`**: add `configure) cmd_configure ${@+"$@"} ;;`.

## Files to Change
- `standalone/bin/kerghan` — `cmd_configure`, `usage`, `main`.
