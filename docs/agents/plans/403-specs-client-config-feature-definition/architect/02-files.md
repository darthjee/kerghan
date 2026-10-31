# files.md
Write `docs/agents/specs/client-config/files.md`: the rules both commands share for reading and
writing the two files.

Sections:
- **The two files** — path, key namespace, how each is read today: config by `load_config`
  (last line wins, trailing `#` comments, malformed / invalid line fails with line number,
  unknown key warns); `kerghan.env` by Docker's env-file parser (literal values, no quoting,
  `#` is part of the value). Known env keys = `DEFAULT_ENV_KEYS` plus the client-managed pair.
- **Missing files** — edge cases 1–3 (create config on first write; create `kerghan.env` as
  `ensure_env_file` does when no data volume; refuse with the `update-env` hint when the volume
  exists).
- **Existing content** — edge cases 4–7 (invalid lines, duplicates, uncommenting the first
  `#key=` template line, unknown lower-case keys refused / any upper-case env key accepted,
  known ones validated with the `valid_*` validators).
- **Values** — edge cases 8–10 (no newlines; no `#` in config values; env values verbatim;
  empty values rejected; `--unset` of a `DEFAULT_ENV_KEYS` key refused).
- **Writing** — edge case 11 (line kept in place, comments and unrelated lines kept, append for
  new keys, mode 600 for `kerghan.env`, config keeps its mode, temp file in the same directory
  then rename, write through symlinks).
- **Apply hint** — the per-key table from "Open decisions settled" 5, strongest hint wins, the
  password-change note (cross-link `security.md`).
- **Required tests** — one line per scenario covering every rule above (e.g. "a set on a file
  with `#port=3000` and no active `port` line uncomments that line", "a set leaves
  `kerghan.env` at mode 600", "missing `kerghan.env` with an existing volume exits 1 with the
  update-env hint and writes nothing").

## Files to Change
- `docs/agents/specs/client-config/files.md` — new.
