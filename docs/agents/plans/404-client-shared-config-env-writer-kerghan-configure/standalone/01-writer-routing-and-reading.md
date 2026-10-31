# Writer: key routing and reading

Add the read side of the shared writer to `standalone/bin/kerghan`, after the existing helpers
and before the `cmd_*` functions. Nothing here writes a file or calls Docker.

- **Key routing** (`files.md` "Key routing"): classify a key as env (`[A-Z_][A-Z0-9_]*`), config
  (`[a-z][a-z0-9-]*`) or malformed. Keep the seven known config keys in one list, in the listing
  order `port variant runtime stop-timeout image-tag auto-login bind`, next to
  `DEFAULT_ENV_KEYS`. Define the secret keys (`KERGHAN_DEFAULT_USER_PASSWORD`,
  `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`) and the client-managed pair the same way.
- **Config reader** that does not exit: parse `config` with the same rules as `load_config`
  (`#` comments to end of line, trimming, blank lines, last line wins), recording per known key
  its effective value, line numbers, and whether the value is valid (the `valid_*` validators);
  recording lines without `=` with their line number; and recording unknown keys. Reuse the
  validators and the "expected" texts `load_config` uses, so error messages match.
- **Env reader** following Docker's env-file rules (`files.md` "The two files"): `#` at line
  start is a comment, leading whitespace before the key ignored, value literal (no trimming),
  bare `KEY` line means "from environment", last line wins. Record each key's effective value
  and kind (value / bare) and preserve file order for custom keys.
- **Effective value and source** of a key: one function used by the listing, the single read and
  later the wizard defaults. Sources as in `configure.md` "Sources": `file`, `default`,
  `derived (auto-login on|off)` for `bind`, `derived (no default user in kerghan.env)` for
  `auto-login` (same fallback as `up`), `not set`, `, invalid`, `, from environment`,
  `unknown (ignored)`, `file, refused (client-managed)`. `image-tag`'s default is
  `KERGHAN_VERSION`.
- **Masking** helper (`security.md` "Masking").
- **`is_tty`**: true when `KERGHAN_ASSUME_TTY=true` (test-only override, not in usage) or stdin
  is a terminal (`[ -t 0 ]`).

## Files to Change
- `standalone/bin/kerghan` — key lists, routing, non-exiting config reader, env reader,
  value/source lookup, masking, `is_tty`.
