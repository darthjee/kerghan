# configure.md
Write `docs/agents/specs/client-config/configure.md`: the `kerghan configure` command.

Sections:
- **Usage** — the exact synopsis lines the client `usage` will print (copied verbatim by #404),
  e.g. `configure [--show-secrets] [--force] [--unset KEY] [KEY[=VALUE|=-]...]`; settle the
  exact wording and how options combine (e.g. `--unset` with sets in one call or not; reads
  and sets not mixed).
- **List** — `kerghan configure`: the format from "Open decisions settled" 4 (two sections,
  aligned columns, sources `file` / `default` / `derived (...)` / `not set`, `, invalid`).
- **Single read** — `kerghan configure <key>`: raw value only, empty line + exit 0 when unset,
  masked secret unless `--show-secrets`; this is the scripting interface (no `--json`).
- **Set** — `key=value [key=value...]`: validate all, write all or nothing, `key: old -> new`
  per change, then the apply hint (`files.md`).
- **`KEY=-`** — hidden input on a TTY, stdin when piped; any key.
- **`--unset KEY`** — removes every line of the key (restrictions in `files.md`).
- **`--show-secrets`, `--force`** — what they unlock (details in `security.md`).
- **Refused keys** — `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`,
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, with the same hint as `up`.
- **Required tests** — one line per scenario (list, single read set/unset, multi-key atomic
  failure writes nothing, `=-` from stdin, `--unset`, refused keys, usage errors exit 2).

## Files to Change
- `docs/agents/specs/client-config/configure.md` — new.
