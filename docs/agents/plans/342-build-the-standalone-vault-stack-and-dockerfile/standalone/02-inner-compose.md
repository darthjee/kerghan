# Inner compose stack

Write `standalone/vault/docker-compose.yml` (copied to `/vault`; Vault runs `docker compose` there).

- `mysql`: `image: mysql:9.3.0`; no `ports:`; `environment` `MYSQL_DATABASE=kerghan`,
  `MYSQL_USER=kerghan`, `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` both
  `${KERGHAN_MYSQL_PASSWORD:-<default>}`; named volume `mysql-data:/var/lib/mysql`; a
  `healthcheck` (`mysqladmin ping -h 127.0.0.1` with interval / retries / `start_period` long
  enough for a first init); `restart: unless-stopped`.
- `kerghan`: `image: darthjee/kerghan:${KERGHAN_VERSION}`; `depends_on: { mysql: { condition: service_healthy } }`;
  `restart: unless-stopped`; no `ports:`. `environment:`
  - fixed, written as literal values (never `${...}`, so they cannot be overridden from the
    Vault container): `NODE_ENV=production`, `PORT=3000`, `KERGHAN_MYSQL_HOST=mysql`,
    `KERGHAN_MYSQL_PORT=3306`, `KERGHAN_MYSQL_NAME=kerghan`, `KERGHAN_MYSQL_USER=kerghan`,
    `KERGHAN_EMAILS_ENABLED=false`;
  - `KERGHAN_MYSQL_PASSWORD=${KERGHAN_MYSQL_PASSWORD:-<default>}` (same default as `mysql`);
  - required secrets and the optional allowlist, **name only** (`- KERGHAN_SECRET_KEY`), so each
    is passed only when set: `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`,
    `FRONTEND_BASE_URL`, `KERGHAN_ALLOWED_ORIGINS`, `KERGHAN_LOG_LEVEL`, every
    `KERGHAN_*_TTL_MS`, `KERGHAN_AUTHORIZATION_REQUEST_*`, `KERGHAN_ACCOUNT_EDIT_*`,
    `KERGHAN_INTEGRATIONS_MAX_PER_USER`, `KERGHAN_INTEGRATIONS_CREDENTIAL_*`,
    `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`, `KERGHAN_GITHUB_OAUTH_APP_*`, `KERGHAN_GITHUB_APP_*`,
    `KERGHAN_PREVIOUS_SECRET_KEYS`, `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` — each family expanded to
    the exact names listed in `docs/agents/environment-variables.md`. No `KERGHAN_EMAIL_*`, no
    `KERGHAN_DEMO_PASSWORD`.
- `tent`: `image: ${TENT_IMAGE}`; `depends_on: [kerghan]`; `restart: unless-stopped`;
  `ports: ["80:80"]`; bind mounts `./tent/configuration:/var/www/html/configuration:ro` and
  `./tent/static:/var/www/html/static:ro` (relative to `/vault`).
- `volumes: { mysql-data: {} }`.

Add a comment block at the top pointing at the specs and explaining the allowlist rule (a
backend variable not listed here never reaches the backend). Add `standalone/vault/tent/static/`
to `.gitignore` (it is filled by the image build), and keep `standalone/vault/.env` out of git.

Verify the file with `docker compose -f standalone/vault/docker-compose.yml config` run through a
throwaway `docker` image (e.g. `docker run --rm -v "$PWD/standalone/vault:/vault" -w /vault docker:cli docker compose config`
with `TENT_IMAGE` / `KERGHAN_VERSION` set), not a host compose install.

## Files to Change

- `standalone/vault/docker-compose.yml` — new inner stack.
- `.gitignore` — ignore `standalone/vault/tent/static/` and `standalone/vault/.env`.
