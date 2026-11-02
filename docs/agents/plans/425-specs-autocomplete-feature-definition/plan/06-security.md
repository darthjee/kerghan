# security.md

Create `docs/agents/specs/auto-complete/security.md`: performance and security (#424 Performance & security 1–9).

- **Performance:**
  - TAB is pure bash: no subprocess (`kerghan`, `docker`, `vault`, `curl`) and no file reads.
  - `kerghan completion bash` has no side effects.
  - The `eval` route costs one client process per new shell, so the docs recommend the lazy-loaded file, with `eval` as the fallback.
- **Trust boundary:** `eval`-ing the client's output trusts nothing beyond running the client.
- **Fixed text:** the emitted script never interpolates environment variables, config values, `$HOME` or paths.
- **Shell hygiene:** the script defines only `_kerghan` (and `_kerghan_*` helpers) plus the `complete` registration.
  - `local` variables only.
  - No `set -e`/`-u`/`pipefail` (the client's own `set -euo pipefail` must not leak), no `shopt`, no lasting `IFS` change.
  - bash 3.2: point to `completion.md`.
- **No secrets:** never read `kerghan.env`, never complete values. Env key names are already public.
- **Installer writes:**
  - The temp file goes in the target directory; `mv -f` is atomic and replaces a symlink rather than following it.
  - `mkdir -p` under the user's umask; the file is not executable.
  - No sudo. Writes only under the same user's `BASH_COMPLETION_USER_DIR`/`XDG_DATA_HOME`.
- **Exact binary:** the installer runs `<install dir>/kerghan`, the same rule as `update`'s exec of the exact path.
- **Required tests:** a behaviour list:
  - Sourcing changes no shell options and leaves no globals beyond `_kerghan*`.
  - TAB runs no subprocess and reads no file.
  - The output contains no environment-derived text.
- **Open marker → #428** on the "Required tests" section.

## Files to Change
- `docs/agents/specs/auto-complete/security.md` — new.
