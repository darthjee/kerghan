# Environment Variables

Every environment variable Kerghan's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

## 1. Backend application runtime

Set on the backend host (Render service env vars in the real deployment; `.env.prod` when
running `kerghan_prod_app` locally to sanity-check the production image).

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `KERGHAN_SECRET_KEY` | **Consumed** | The current secret key. Signs every new JWT access token, derives the HMAC cache token (`CacheTokenService` has no callers yet), and is the first secret handed to `cookie-parser` (no cookie is signed today, so this is dormant). Must be a long random value in production — the dev sample ships an intentionally insecure placeholder. See "Rotating `KERGHAN_SECRET_KEY`" below. | `backend/src/core/secret-keys.ts`, `backend/src/app.module.ts`, `backend/src/core/cache-token.service.ts`, `backend/src/main.ts` |
| `KERGHAN_PREVIOUS_SECRET_KEYS` | **Consumed**, optional | Comma-separated list of retired secret keys, still accepted when verifying JWT access tokens (tried after the current key, in order) and passed to `cookie-parser` after the current key. Never used to sign anything. Entries are trimmed; blanks, duplicates and any entry equal to `KERGHAN_SECRET_KEY` are dropped. Defaults to empty. | `backend/src/core/secret-keys.ts`, `backend/src/core/jwt.guard.ts`, `backend/src/main.ts` |
| `KERGHAN_ACCESS_TOKEN_TTL_MS` | **Consumed**, optional | Access-token lifetime, in milliseconds. Drives both the signed JWT's `signOptions.expiresIn` (`app.module.ts`, converted to seconds for `jsonwebtoken`) and the `access_token` cookie's `maxAge` (`auth.controller.ts`, used as-is), so the two always agree. Defaults to `900000` (15 minutes) when unset. | `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` | **Consumed**, optional | How long a device-authorization request (`POST /auth/authorization-requests.json`) stays pollable before lazily flipping to `expired`, in milliseconds. Defaults to `3600000` (1 hour) when unset. | `backend/src/auth/authorization-request.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT` | **Consumed**, optional | Per-IP/per-username request count allowed within the sliding window before `create` is throttled. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` | **Consumed**, optional | Sliding window (milliseconds) the `create` rate limit above counts requests over. Defaults to `60000` (1 minute). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` | **Consumed**, optional | Cap on a resolved user's simultaneous `open` authorization requests; the oldest is evicted (flipped to `expired`) to make room for a new one rather than rejecting it. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive wrong-password `authorize` attempts, per request row, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive failed `PATCH /auth/account.json` attempts (wrong current password, duplicate username/email), per user, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `KERGHAN_ACCOUNT_EDIT_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `KERGHAN_INTEGRATIONS_KEY` | **Consumed**, **required** | AES-256-GCM key that encrypts every stored integration credential (see `docs/agents/specs/integrations/security.md`). Base64 of exactly 32 bytes, read once at boot. Boot fails, naming the variable but never the value, when it is missing, blank, not base64, the wrong length, equal to `KERGHAN_SECRET_KEY`, or equal to the public dev placeholder while `NODE_ENV=production`. See "Setting `KERGHAN_INTEGRATIONS_KEY`" below. | `backend/src/integrations/integrations-key.ts` |
| `KERGHAN_INTEGRATIONS_MAX_PER_USER` | **Consumed**, optional | Cap on how many integrations a single user may hold; creating one past it answers `409`. Defaults to `20`. | `backend/src/integrations/integrations.service.ts` |
| `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive counted credential-validation failures (create / replace credential), per user, that trip the cool-off lockout (`423`). Defaults to `5`. | `backend/src/integrations/integration-credential-abuse-guard.service.ts` |
| `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `900000` (15 minutes). | `backend/src/integrations/integration-credential-abuse-guard.service.ts` |
| `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS` | **Consumed**, optional | Minimum interval (milliseconds) between two tests of the same integration; an earlier test answers `429` with `Retry-After`. Defaults to `30000` (30 seconds). | `backend/src/integrations/integration-test-cooldown.service.ts` |
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` | **Consumed**, optional | Client id of the GitHub OAuth App behind the `oauth_app` integration type: 1–100 characters of `[A-Za-z0-9._-]`. Read once at boot and trimmed. When this and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` are both unset/blank, the `oauth_app` type is disabled. Boot fails, naming the missing variable but never either value, when only one of the two is set or the client id is malformed. See "Setting up the GitHub OAuth App" below. | `backend/src/integrations/types/oauth-app/oauth-app-config.ts` |
| `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` | **Consumed**, optional, **secret** | Client secret of that same OAuth App. Read once at boot and trimmed. Never logged, never returned by any API, never included in an error message. Must be set together with the client id (see the row above). | `backend/src/integrations/types/oauth-app/oauth-app-config.ts` |
| `KERGHAN_GITHUB_APP_ID` | **Consumed**, optional | Id of the GitHub App behind the `github_app` integration type: a positive integer. One of five all-or-nothing variables (this one plus `KERGHAN_GITHUB_APP_SLUG`, `KERGHAN_GITHUB_APP_PRIVATE_KEY`, `KERGHAN_GITHUB_APP_CLIENT_ID`, `KERGHAN_GITHUB_APP_CLIENT_SECRET`), read once at boot and trimmed. All five unset/blank disables the type; only some set, or any malformed, fails boot, naming the variables but never a value. See "Setting up the GitHub App" below. | `backend/src/integrations/types/github-app/github-app-config.ts` |
| `KERGHAN_GITHUB_APP_SLUG` | **Consumed**, optional | The GitHub App's URL slug (1–100 characters of `[a-z0-9-]`), used to build the installation URL `https://github.com/apps/<slug>/installations/new`. All-or-nothing with the other four. | `backend/src/integrations/types/github-app/github-app-config.ts` |
| `KERGHAN_GITHUB_APP_PRIVATE_KEY` | **Consumed**, optional, **secret** | The GitHub App's private key: **base64 of the PEM file, on one line, unquoted**. Decoded and parsed at boot; must be an RSA private key (GitHub's PKCS#1 `BEGIN RSA PRIVATE KEY` file is accepted as-is). Signs the app JWTs. Never logged, returned, or included in an error message. All-or-nothing with the other four. | `backend/src/integrations/types/github-app/github-app-config.ts` |
| `KERGHAN_GITHUB_APP_CLIENT_ID` | **Consumed**, optional | The GitHub App's client id (1–100 characters of `[A-Za-z0-9._-]`), used for the user-authorization step. All-or-nothing with the other four. | `backend/src/integrations/types/github-app/github-app-config.ts` |
| `KERGHAN_GITHUB_APP_CLIENT_SECRET` | **Consumed**, optional, **secret** | The GitHub App's client secret. Never logged, returned, or included in an error message. All-or-nothing with the other four. | `backend/src/integrations/types/github-app/github-app-config.ts` |
| `NODE_ENV` | **Consumed**, set to `production` in production | Read only by the CORS resolver and by the OAuth App and GitHub App configs: when exactly `production`, a `*` entry in `KERGHAN_ALLOWED_ORIGINS` fails boot, and so does a non-`https` `FRONTEND_BASE_URL` while the `oauth_app` or `github_app` type is enabled. The CORS guard fails open — if it is unset or mistyped (`prod`), a `*` is accepted and reflects any origin with credentials — so production deployments must set `NODE_ENV=production`. Nothing else depends on it — the access-token cookie is always `Secure`/`httpOnly`/`SameSite=Strict` regardless of environment. | `backend/src/core/cors-config.ts`, `backend/src/integrations/types/oauth-app/oauth-app-config.ts`, `backend/src/integrations/types/github-app/github-app-config.ts` |
| `PORT` | **Consumed**, optional | Port the Nest HTTP server listens on (defaults to `8080`). Render injects its own `PORT` automatically — only set this explicitly for other hosts. | `backend/src/main.ts` |
| `KERGHAN_MYSQL_HOST` | **Consumed** | Production MySQL connection. | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `KERGHAN_MYSQL_PORT` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `KERGHAN_MYSQL_USER` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `KERGHAN_MYSQL_PASSWORD` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `KERGHAN_MYSQL_NAME` | **Consumed** | ditto | `backend/src/database/data-source.ts`, `backend/src/app.module.ts` |
| `KERGHAN_DEMO_PASSWORD` | **Consumed**, dev/seed-only | Password for the `demo` user seeded by the demo-seed migration. Falls back to a non-working placeholder (`kerghan-demo-placeholder`) if unset, so the real dev password only exists in `.env`/`.env.dev.sample`, never in source. | `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` |
| `KERGHAN_ALLOWED_ORIGINS` | **Consumed**, optional | Credentialed CORS allowlist (`credentials: true`), resolved once at boot. Comma-separated list of bare origins — `scheme://host[:port]`, `http`/`https` only, no path, query, fragment or trailing slash (e.g. `https://app.example.com,http://localhost:3000`); whitespace is trimmed, empty entries are rejected. Takes precedence over `FRONTEND_BASE_URL`. `*` (must be the sole entry) reflects any request origin and is dev-only — boot fails with it when `NODE_ENV=production`. Any malformed entry fails boot with an error naming the variable and the entry. When both this and `FRONTEND_BASE_URL` are unset/blank, CORS stays disabled (same-origin only). The same resolved list also defines the origins `OriginGuard` trusts for cross-site `POST`/`PUT`/`PATCH`/`DELETE` (CSRF) — see `docs/agents/architecture/security.md` — so adding an origin here is a trust change, not just a CORS tweak. | `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts`, `backend/src/main.ts` |
| `FRONTEND_BASE_URL` | **Consumed** | Base URL for password-reset links, and the CORS allowlist fallback: when `KERGHAN_ALLOWED_ORIGINS` is unset/blank, CORS allows only this URL's origin (path dropped), and `OriginGuard` trusts that same origin for CSRF. An unparseable or non-http(s) value fails boot. Its origin plus `/integrations/oauth_app/callback` is also the GitHub OAuth App callback URL, and its origin plus `/integrations/github_app/callback` the GitHub App callback URL; while the `oauth_app` or `github_app` type is enabled it is required, and must be `https` when `NODE_ENV=production`, or boot fails. | `backend/src/auth/password-reset.service.ts`, `backend/src/core/cors-config.ts`, `backend/src/core/origin.guard.ts`, `backend/src/integrations/types/oauth-app/oauth-app-config.ts`, `backend/src/integrations/types/github-app/github-app-config.ts` |
| `KERGHAN_EMAILS_ENABLED` | **Consumed**, optional | Master toggle; `'true'` enables outbound sending, anything else (default) disables it (log-and-skip). | `backend/src/mail/mail.config.ts`, `backend/src/mail/mail.module.ts` |
| `KERGHAN_EMAIL_HOST` | **Consumed** (required when enabled) | SMTP host. Boot throws if enabled without it. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_PORT` | **Consumed**, optional | SMTP port; defaults to `587`. `465` ⇒ implicit TLS (`secure`); other ports ⇒ STARTTLS when `KERGHAN_EMAIL_USE_TLS`. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_USER` | **Consumed**, optional | SMTP auth username. `auth` is sent only when both user and password are set. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_PASSWORD` | **Consumed**, optional | SMTP auth password. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_USE_TLS` | **Consumed**, optional | Forces a STARTTLS upgrade on non-465 ports. Defaults to `true`. `KERGHAN_EMAIL_USE_TLS=false` is ignored (STARTTLS still required) when SMTP credentials are configured. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_FROM` | **Consumed** (required when enabled) | Default `From:` address. Must be one the SMTP server is authorized to send as (SPF/DKIM). | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_TIMEOUT_MS` | **Consumed**, optional | Bounds nodemailer's connection/greeting/socket timeouts. Defaults to `10000`. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_METHOD` | **Consumed**, optional | Selects the `EmailMethod` `MailService#sendEmail` delivers through (currently only `native`, the nodemailer transport). Defaults to `native`. Boot throws if set to an unregistered name. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_LOG_LEVEL` | **Consumed**, optional | Log-level threshold (`debug`/`info`/`warn`/`error`) for the Core logger service; defaults to `info` when unset. | `backend/src/core/logger.service.ts` |

**Device-authorization tuning — undocumented-but-defaulted in dev.** None of the six
`KERGHAN_AUTHORIZATION_REQUEST_*` variables above (TTL plus the five rate-limit/cap/cool-off keys)
are set in `.env.dev.sample` — local dev runs entirely on their code-level defaults (see each
row above). Set them explicitly only if a deployment needs different tuning. The same applies to
the four numeric `KERGHAN_INTEGRATIONS_*` tuning variables (`MAX_PER_USER`,
`CREDENTIAL_MAX_ATTEMPTS`, `CREDENTIAL_LOCK_MS`, `TEST_COOLDOWN_MS`); only
`KERGHAN_INTEGRATIONS_KEY` is set in the sample, because it has no default.

### Setting `KERGHAN_INTEGRATIONS_KEY`

`KERGHAN_INTEGRATIONS_KEY` has no default, so the backend refuses to boot without a valid one.

- **Set it on the backend host (Render) before deploying the integrations module (#300).**
  Otherwise the new release fails to boot.
- Generate it with `openssl rand -base64 32`, which gives the base64 of exactly 32 random bytes.
- It must differ from `KERGHAN_SECRET_KEY`. Boot fails when the two are equal.
- The placeholder in `.env.dev.sample` (`a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=`) is public.
  Boot refuses it when `NODE_ENV=production`, so production must also set
  `NODE_ENV=production` for that guard to apply.
- Treat it as permanent. If the key is lost or changed, every stored credential becomes
  `undecryptable` and each user has to replace it. Key rotation (previous keys kept for
  decryption) is not supported yet; it is tracked in #305.
- Existing local `.env` files are not regenerated (`make` only copies the sample when `.env` is
  missing). Add the `KERGHAN_INTEGRATIONS_KEY=...` line from `.env.dev.sample` by hand.

### Setting up the GitHub OAuth App

`KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` enable the
`oauth_app` integration type (spec: `docs/agents/specs/integrations/types/oauth-app.md`). Both are
optional and read once at boot:

- **Both unset or blank:** the type is disabled. It is not listed among the integration types, its
  routes answer `404`, and existing `oauth_app` integrations stay listed but can't be reconnected.
- **Only one set, or a malformed client id:** boot fails, naming the missing or invalid variable
  but never printing either value.
- **The client secret is a secret.** Never log it, return it, or put it in an error message.
  Keep it out of committed files; set it only in `.env` (dev) or the backend host's env vars.
- **Callback URL:** not a separate variable. It is the origin of `FRONTEND_BASE_URL` plus
  `/integrations/oauth_app/callback`, computed at boot. While the type is enabled,
  `FRONTEND_BASE_URL` must be set, and must be `https` when `NODE_ENV=production`, or boot fails.

Each environment registers its own OAuth App on GitHub, whose *Authorization callback URL* is
exactly that environment's callback URL:

| Environment | Callback URL | Config |
|---|---|---|
| Dev | `http://localhost:3000/integrations/oauth_app/callback` (Tent's port) | Disabled by default. To try it, register a personal OAuth App with this callback URL and set both variables in `.env`. `.env.dev.sample` lists them commented out. |
| CI | none | Unset, so the type is disabled. Specs use fake config and a fake GitHub client. |
| Production | `https://<public host>/integrations/oauth_app/callback` | Its own OAuth App, registered with the public host's callback URL. Set both variables as backend host env vars (Render). Not enabled yet. |

No `docker-compose.yml`, CI or deploy-script change is needed: compose's `env_file: .env` already
passes both variables to the backend when they are set.

### Setting up the GitHub App

`KERGHAN_GITHUB_APP_ID`, `KERGHAN_GITHUB_APP_SLUG`, `KERGHAN_GITHUB_APP_PRIVATE_KEY`,
`KERGHAN_GITHUB_APP_CLIENT_ID` and `KERGHAN_GITHUB_APP_CLIENT_SECRET` enable the `github_app`
integration type (spec: `docs/agents/specs/integrations/types/github-app.md`, *Server config*).
All five are optional, all-or-nothing, read once at boot and trimmed:

- **All five unset or blank:** the type is disabled. It is not listed among the integration types,
  its three routes (`start.json`, `callback.json`, `select.json`) answer `404`, and existing
  `github_app` integrations stay listed (rename and delete still work) but can't be tested or
  reconnected.
- **Some set, some not, or any malformed** (non-numeric id, bad slug, a key that doesn't decode or
  parse as an RSA private key, bad client id): boot fails, naming the variables but never printing
  any value.
- **The private key and the client secret are secrets.** Never log them, return them, or put them
  in an error message. Keep them out of committed files; set them only in `.env` (dev) or the
  backend host's env vars.
- **Callback URL:** not a separate variable. It is the origin of `FRONTEND_BASE_URL` plus
  `/integrations/github_app/callback`, computed at boot. While the type is enabled,
  `FRONTEND_BASE_URL` must be set, and must be `https` when `NODE_ENV=production`, or boot fails.

Each environment registers its own GitHub App, so keys and callback URLs never cross
environments:

| Environment | Callback URL | Config |
|---|---|---|
| Dev | `http://localhost:3000/integrations/github_app/callback` (Tent's port) | Disabled by default. To try it, register a personal throwaway GitHub App with this callback URL and set all five variables in `.env`. `.env.dev.sample` lists them commented out. |
| CI | none | Unset, so the type is disabled. Specs use fake config (a test-only RSA key generated in the spec) and a fake GitHub client. |
| Production | `https://<public host>/integrations/github_app/callback` | Its own GitHub App, registered with the public host's callback URL. Set all five variables as backend host env vars (Render). Not enabled yet. |

**App settings to register on GitHub** (per environment):

- *Callback URL*: the environment's callback URL above.
- *Request user authorization (OAuth) during installation*: **on**. This disables the setup URL,
  which Kerghan doesn't use. It is what lets the backend verify that the user actually owns the
  installation.
- *Expire user authorization tokens*: either; the refresh token is never used.
- *Webhook*: **inactive** (no webhook URL or secret).
- Repository permissions: **Issues: read** and **Metadata: read**; nothing else.
- *Where can this GitHub App be installed?*: *Any account* in production; either in dev.

**Private key format.** GitHub hands out the key as a PEM file. Kerghan wants the **base64 of that
whole file, on a single line**:

- Produce it with `base64 -w0 key.pem` (GNU/Linux) or `base64 -i key.pem` (macOS). Both print a
  single line; without `-w0`, GNU `base64` wraps at 76 columns and the value breaks.
- Paste it **unquoted** (`KERGHAN_GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTi...`). Quotes become part
  of the value in some env loaders and the key no longer decodes.
- GitHub's file is PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`). That is accepted as-is; there is no
  need to convert it to PKCS#8.
- **Never paste the raw PEM** into Render's (or any) env var field. Multi-line values get
  mangled; always use the base64 form.

Registering the production GitHub App and setting its five values in Render is a **manual ops
step**, outside any code change.

No `docker-compose.yml`, CI or deploy-script change is needed: compose's `env_file: .env` (and
`.env.prod` for `kerghan_prod_app`) already passes the variables to the backend when they are set,
production runs on Render where they are set in the dashboard, and CI leaves them unset.

### Rotating `KERGHAN_SECRET_KEY`

Keys must not contain commas, and must not have leading or trailing whitespace. Entries in
`KERGHAN_PREVIOUS_SECRET_KEYS` are trimmed, so a padded key would no longer match the value
that signed the old tokens.

**Routine rotation (zero downtime).** Use this only when the old key is *not* suspected to be
compromised:

1. Generate a new long random key.
2. Deploy with `KERGHAN_SECRET_KEY=<new>` and `KERGHAN_PREVIOUS_SECRET_KEYS=<old>`. New access
   tokens are signed with `<new>`; tokens already issued with `<old>` keep verifying.
3. Wait at least `KERGHAN_ACCESS_TOKEN_TTL_MS` (default 15 minutes), counted from the moment
   *every* backend instance runs the new config (instances still on the old config keep signing
   with `<old>`), so every access token signed with `<old>` has expired.
4. Deploy again with `<old>` removed from `KERGHAN_PREVIOUS_SECRET_KEYS`.

If Kerghan runs several backend instances behind a rolling deploy, old instances would reject tokens signed with `<new>` during the rollout. Use three
phases instead: (a) `KERGHAN_SECRET_KEY=<old>`, `KERGHAN_PREVIOUS_SECRET_KEYS=<new>`; (b)
`KERGHAN_SECRET_KEY=<new>`, `KERGHAN_PREVIOUS_SECRET_KEYS=<old>`; (c) remove `<old>`.

**Compromised key.** Do not list the leaked key in `KERGHAN_PREVIOUS_SECRET_KEYS`, because
anyone holding it could keep forging access tokens until it is removed. Deploy the new
`KERGHAN_SECRET_KEY` with the old key dropped entirely. Every outstanding access token is
rejected at once. Clients recover through the refresh flow, because refresh tokens do not
depend on the key.

Side effects (both variants):

- The cache token is always derived from the current key only, so it changes on the first
  deploy. That only causes cache misses.
- Refresh tokens are random values stored as SHA-256 hashes and do not depend on the key, so
  they are unaffected.

**GitHub credentials — integrations only.** Issue fetching still reads public GitHub REST API
data unauthenticated (see `docs/agents/product.md`). User-supplied GitHub credentials are stored
only as integrations (`docs/agents/specs/integrations/`), encrypted with
`KERGHAN_INTEGRATIONS_KEY`. There is no server-wide GitHub token variable to set; don't add one
without an explicit product decision. The OAuth App client id/secret above identify Kerghan's own
OAuth App (used to run the `oauth_app` integration flow), not a credential for reading GitHub.
Likewise, the GitHub App id, slug, private key, client id and client secret identify Kerghan's own
GitHub App (used to run the `github_app` install/connect flow and to mint installation tokens for
each user's own installation), not a server-wide credential for reading GitHub.

## 2. Proxy (production)

The production Tent proxy needs **no environment variables** — its config comes entirely from
`proxy/prod_configuration/locals.php` (real file gitignored; `locals.php.sample` is the
committed template), which is generated directly on the SSH host, not read from `.env.prod`.
`FRONTEND_DEV_MODE` only matters in `proxy/dev_configuration/` (local dev's Vite-vs-static
toggle) — don't look for a production equivalent, there isn't one.

## 3. Cache warmer (Navi)

Used by the `kerghan_navi` compose service and the CI `warm-up-cache`/`wake-navi` jobs (see
`docs/agents/cache-warmer.md`):

| Variable | Purpose | Source |
|---|---|---|
| `KERGHAN_PRODUCTION_URL` | Base URL Navi warms requests against. | `navi/resources/clients.yml`, `docker-compose.yml` |
| `NAVI_NAMEPACE` | Navi cache namespace. | `navi/resources/clients.yml`, `scripts/warm_navi_cache.sh` |
| `NAVI_PORT` | Port Navi's own web UI listens on locally (`3100` in dev). | `navi/navi_config.yaml`, `docker-compose.yml` |

## 4. CircleCI project variables (deploy pipeline)

Not part of any `.env` file — set directly in CircleCI's project (or org) settings, consumed as
plain shell env vars by `scripts/`/`bin/` during CI jobs. `.circleci/config.yml`'s release chain
(`build-and-release`, `upload_proxy_files`, `copy_proxy_configuration`, `upload_extension`,
`upload_fe_files`, `release`), gated to semver tag pushes, requires every variable below. No real
Render service or SSH deploy host exists for Kerghan yet, though — provisioning that
infrastructure and filling in these values is a separate, not-yet-done step; until then, a tag
push runs the jobs but they fail against unset/placeholder credentials.

| Variable | Purpose | Used by |
|---|---|---|
| `DOCKER_ID_USER` | Docker Hub namespace for pushed images (frontend/proxy only — the backend image is never published, see `docs/agents/architecture/backend.md`). | `bin/image.sh` |
| `DOCKER_HUB_USERNAME` / `DOCKER_HUB_PASSWORD` | Docker Hub login for pushing images. | `bin/image.sh` |
| `RENDER_API_KEY` | Authenticates Render API calls (trigger/watch deploys). | `scripts/render.sh` |
| `RENDER_SERVICE_NAME` | Which Render service to deploy (defaults to `kerghan`). | `scripts/render.sh` |
| `SSH_PRIVATE_KEY` | SSH key for the proxy/static-asset deploy host. | `bin/deploy_frontend.sh` |
| `SSH_HOST` / `SSH_PORT` / `SSH_USER` | ditto | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_DIR` | Live path on the deploy host, atomically swapped on release. | `bin/deploy_frontend.sh` |
| `SSH_REMOTE_TEMP_DIR` | Workspace-scoped staging path before the atomic swap. | `bin/deploy_frontend.sh` |
| `NAVI_URL` | Navi server URL for cache warm-up and wake calls. | `scripts/warm_navi_cache.sh`, `scripts/wake_navi.sh` |
| `NAVI_API_TOKEN` | Auth token for Navi's `navi-client`. | `scripts/warm_navi_cache.sh` |
| `KERGHAN_NAMESPACE` | Combined with the CircleCI workspace ID to build a per-build Navi namespace. | Not yet consumed — reserved for a future `warm-up-cache` job (cache warm-up is out of scope for the current release chain; see `docs/agents/cache-warmer.md`). |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
