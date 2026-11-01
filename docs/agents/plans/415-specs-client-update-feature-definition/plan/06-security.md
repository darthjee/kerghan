# security.md: trust model and safe execution

Write `docs/agents/specs/client-update/security.md`:

- **Trust model:** the same trust as the first install (`curl … | bash` from the GitHub release over HTTPS). Checksum verification is out of scope: `SHA256SUMS` from the same release only catches corruption, not a compromised release, and real protection needs signatures (a possible future hardening issue).
- **Download to a file, never pipe into bash:** `curl -fsSL` to a file in a `mktemp -d` staging folder, cleaned up on exit (trap). A failed or empty download is detected before anything runs.
- **Strict `VERSION` validation** (cross-link to `versions.md`), so the URL cannot be manipulated (`../`, `?`, spaces).
- **Exact path execution:** resolve the real path of the running client (symlinks resolved) for `KERGHAN_INSTALL_DIR`, and `exec` exactly `<install dir>/kerghan`, never a `PATH` lookup.
- **No sudo, no GitHub credentials, no API:** an install dir that isn't writable fails with the installer's error and a hint.
- **Secrets:** `kerghan.env` values are never printed. The env step only adds missing keys, keeping existing values, file permissions and atomic writes (`write_file_atomic`).
- **Downgrade risk:** the warning names it, and the confirmation or `--yes` is required.
- **Required tests:** no value from `kerghan.env` appears in the output; temp files are removed on success and on failure; a symlinked client updates the target file; `VERSION` values with URL metacharacters are rejected before any download; the installer is never piped into bash.

## Files to Change
- `docs/agents/specs/client-update/security.md` — new.
