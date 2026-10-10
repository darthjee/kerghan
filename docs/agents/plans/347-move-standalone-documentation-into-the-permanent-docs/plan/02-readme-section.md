# Add the README "Run Kerghan standalone" section

Add a short, user-facing "Run Kerghan standalone" section to `README.md`, between "Project
Structure" and "Development Setup". Contents:

- What it is: one container running MySQL, the backend and the frontend, for self-hosting and
  local use.
- Requirements: Linux or macOS, Docker with Sysbox or `--privileged`.
- Install: the `curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash`
  one-liner. Upgrade: rerun the installer, then `kerghan up`.
- Run: `kerghan up` (opens on `http://localhost:3000`), `-p PORT`, `--offline`, and a one-line
  list of the other commands (`down`, `logs`, `status`, `reset`).
- The online and offline variants (`darthjee/kerghan-standalone:<v>` and `:<v>-offline`) and
  when to use each. Plain `docker run` users must pass `--privileged`, the secrets and
  `FRONTEND_BASE_URL` themselves.
- The `~/.kerghan/` layout: `config` (optional settings, see `config.example`) and
  `kerghan.env` (generated secrets plus pass-through variables).
- Caveats, briefly, each with a link to the full text in `docs/agents/standalone.md#caveats`.

Also add `standalone/` to the "Project Structure" tree, and link to
`docs/agents/standalone.md` and `docs/agents/environment-variables.md#standalone` for details.

## Files to Change

- `README.md` — new "Run Kerghan standalone" section; `standalone/` in the project tree
