# Docs

Document the command for users and for agents.

- **New `docs/agents/standalone/client-diagnose.md`**: what it checks and in which order, the
  two probes (published address and advertised URL) and why, how Kerghan is identified
  (`/health.json` body, `/ready.json`), the output markers, the verdict and exit-code table, the
  skipped cases (remote engine, no `curl`, no `lsof`/`ss`), and the security rules (read-only, no
  secrets, sanitized `Server`, hardened curl, `~/` paths). Note that the server-side marker is
  #609.
- **`docs/agents/standalone.md`**: add a row to the "Pages" table:
  `client-diagnose.md | You change kerghan diagnose.`
- **`docs/agents/standalone/client.md`**: add `kerghan diagnose` to the command list (next to
  `kerghan status`), and mention the new hint line where the port conflict warning is described.
- **`docs/agents/standalone/release-and-caveats.md`**: in the macOS AirPlay caveat, point to
  `kerghan diagnose` as the way to tell which process answers.
- **`README.md`**: add `kerghan diagnose` next to `kerghan status` in the standalone commands
  paragraph.

## Files to Change

- `docs/agents/standalone/client-diagnose.md`: new.
- `docs/agents/standalone.md`: "Pages" row.
- `docs/agents/standalone/client.md`: command list and the warning's hint.
- `docs/agents/standalone/release-and-caveats.md`: the AirPlay caveat.
- `README.md`: the standalone commands paragraph.
