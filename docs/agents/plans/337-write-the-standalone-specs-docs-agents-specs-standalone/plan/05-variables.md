# Write variables.md

Create `docs/agents/specs/standalone/variables.md`:

- How values flow: `-e` / `--env-file` / the client's env file → Vault container env → inner
  compose interpolation → per-service `environment:`. No secret baked into the image.
- Contract table:
  - Required secrets: `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` (backend boot validation
    fails loudly when missing).
  - Internal, fixed: `KERGHAN_MYSQL_HOST=mysql`, `KERGHAN_MYSQL_PORT=3306`, `KERGHAN_MYSQL_NAME`,
    `KERGHAN_MYSQL_USER`, `PORT`, `NODE_ENV=production`, `KERGHAN_EMAILS_ENABLED=false`, Tent's
    `$backendHost`.
  - Overridable with default: `KERGHAN_MYSQL_PASSWORD` (also `MYSQL_PASSWORD` /
    `MYSQL_ROOT_PASSWORD`), caveat: fixed at first volume initialization.
  - Pass-through allowlist (names only in `environment:`): `FRONTEND_BASE_URL`,
    `KERGHAN_ALLOWED_ORIGINS`, `KERGHAN_LOG_LEVEL`, the TTL / rate-limit / integrations tuning
    variables, the GitHub OAuth App and GitHub App sets, `KERGHAN_PREVIOUS_*`. Reference
    `docs/agents/environment-variables.md` for each variable's meaning rather than copying it.
  - Standalone/Vault level: host port, `VAULT_DOCKERD_TIMEOUT`, `COMPOSE_UP_ARGS` (baked in the
    offline variant).
  - Excluded: `KERGHAN_EMAIL_*`, `KERGHAN_DEMO_PASSWORD`.
- `FRONTEND_BASE_URL`: the client defaults it to `http://localhost:<port>`; plain `docker run`
  users set it themselves.
- Shipped: `kerghan.env.example` release asset; a "Standalone" section in
  `environment-variables.md` (written by #347).
- **Required tests:** a variable outside the allowlist does not reach the backend; an allowlisted
  one does; boot fails without either required secret; the MySQL default works on a fresh volume.

## Files to Change
- `docs/agents/specs/standalone/variables.md` — new.
