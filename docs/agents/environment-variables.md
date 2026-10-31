# Environment Variables

Every environment variable Kerghan's production deployment needs, gathered from what the code
actually reads (not just what's documented elsewhere) — grep the `Source` column if in doubt.
Local dev's equivalent is `.env.dev.sample` (copied to `.env` by `make setup`); nothing here
should drift from that file without a reason noted below. Real `.env.prod` / CircleCI project
variables are never committed (`.gitignore`) — this doc is the map for filling them in.

The standalone image (`darthjee/kerghan-standalone`) passes a subset of these variables to its
backend; see [section 5](#5-standalone-darthjeekerghan-standalone).

## 1. Backend application runtime

Set on the backend host (Render service env vars in the real deployment; `.env.prod` when
running `kerghan_prod_app` locally to sanity-check the production image).

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `KERGHAN_SECRET_KEY` | **Consumed** | The current secret key. Signs every new JWT access token, derives the HMAC cache token (`CacheTokenService` has no callers yet), and is the first secret handed to `cookie-parser` (no cookie is signed today, so this is dormant). Must be a long random value in production — the dev sample ships an intentionally insecure placeholder. See "Rotating `KERGHAN_SECRET_KEY`" below. | `backend/src/core/secret-keys.ts`, `backend/src/app.module.ts`, `backend/src/core/cache-token.service.ts`, `backend/src/main.ts` |
| `KERGHAN_PREVIOUS_SECRET_KEYS` | **Consumed**, optional | Comma-separated list of retired secret keys, still accepted when verifying JWT access tokens (tried after the current key, in order) and passed to `cookie-parser` after the current key. Never used to sign anything. Entries are trimmed; blanks, duplicates and any entry equal to `KERGHAN_SECRET_KEY` are dropped. Defaults to empty. | `backend/src/core/secret-keys.ts`, `backend/src/core/jwt.guard.ts`, `backend/src/main.ts` |
| `KERGHAN_ACCESS_TOKEN_TTL_MS` | **Consumed**, optional | Access-token lifetime, in milliseconds. Drives both the signed JWT's `signOptions.expiresIn` (`app.module.ts`, converted to seconds for `jsonwebtoken`) and the `access_token` cookie's `maxAge` (`auth.controller.ts`, used as-is), so the two always agree. Defaults to `900000` (15 minutes) when unset. | `backend/src/app.module.ts`, `backend/src/auth/auth.controller.ts` |
| `KERGHAN_REFRESH_TOKEN_TTL_MS` | **Consumed**, optional | Regular refresh-token lifetime, in milliseconds — used for every session that did not opt into "keep me signed in" (and for register). Defaults to `604800000` (7 days). Unset or non-numeric falls back to the default; `0`/negative falls back to the default and logs one warning per process (naming only the variable and the fallback). Read on every mint, so a change applies only to tokens minted afterwards. | `backend/src/auth/token.service.ts` |
| `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS` | **Consumed**, optional | Persistent refresh-token lifetime, in milliseconds — used for sessions opened with `keepSignedIn: true` (password login or device authorization), renewed on every rotation. Defaults to `2592000000` (30 days). Same fallback/warning and "newly minted tokens only" rules as `KERGHAN_REFRESH_TOKEN_TTL_MS`. Expected to be longer than the regular TTL, but a shorter value is neither rejected nor clamped. | `backend/src/auth/token.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` | **Consumed**, optional | How long a device-authorization request (`POST /auth/authorization-requests.json`) stays pollable before lazily flipping to `expired`, in milliseconds. Defaults to `3600000` (1 hour) when unset. | `backend/src/auth/authorization-request.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT` | **Consumed**, optional | Per-IP/per-username request count allowed within the sliding window before `create` is throttled. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS` | **Consumed**, optional | Sliding window (milliseconds) the `create` rate limit above counts requests over. Defaults to `60000` (1 minute). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER` | **Consumed**, optional | Cap on a resolved user's simultaneous `open` authorization requests; the oldest is evicted (flipped to `expired`) to make room for a new one rather than rejecting it. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive wrong-password `authorize` attempts, per request row, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/authorization-request-abuse-guard.service.ts` |
| `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` | **Consumed**, optional | Consecutive failed `PATCH /auth/account.json` attempts (wrong current password, duplicate username/email), per user, that trip the cool-off lockout. Defaults to `5`. | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `KERGHAN_ACCOUNT_EDIT_LOCK_MS` | **Consumed**, optional | Cool-off duration (milliseconds) once the max-attempts threshold above is reached. Defaults to `300000` (5 minutes). | `backend/src/auth/account-edit-abuse-guard.service.ts` |
| `KERGHAN_INTEGRATIONS_KEY` | **Consumed**, **required** | AES-256-GCM key that encrypts every stored integration credential (see `docs/agents/modules/integrations.md#encryption-at-rest`). Base64 of exactly 32 bytes, read once at boot. Boot fails, naming the variable but never the value, when it is missing, blank, not base64, the wrong length, equal to `KERGHAN_SECRET_KEY`, or equal to the public dev placeholder while `NODE_ENV=production`. Rotatable through `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`. See "Setting `KERGHAN_INTEGRATIONS_KEY`" and "Rotating `KERGHAN_INTEGRATIONS_KEY`" below. | `backend/src/integrations/integrations-key.ts` |
| `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` | **Consumed**, optional | Comma-separated retired integrations keys, **decrypt-only**, used during a `KERGHAN_INTEGRATIONS_KEY` rotation. Defaults to empty. Entries are trimmed; blank entries, duplicates and entries equal to the current key are dropped. Each remaining entry is validated like `KERGHAN_INTEGRATIONS_KEY` (base64 of exactly 32 bytes, not `KERGHAN_SECRET_KEY`, not the dev placeholder in production), and boot fails when two configured keys share a key id. Errors name the variable and the entry's 1-based position, never the value. | `backend/src/integrations/integrations-key.ts` |
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
| `KERGHAN_DEFAULT_USER_ENABLED` | **Consumed**, optional flag | When `true`, create or synchronize the [default user](modules/auth/default-user.md) at boot and block API edits of its managed fields. Defaults to off. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` | **Consumed**, optional flag | When `true`, `POST /auth/status.json` logs a client with no valid session and an allowed IP in as the default user ([automatic login](modules/auth/default-user.md#automatic-login)). Implies `ENABLED`. Defaults to off. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_USERNAME` | **Consumed**, required when enabled | The default user's username. Trimmed. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_EMAIL` | **Consumed**, required when enabled | The default user's email; must be a valid email. Trimmed. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_PASSWORD` | **Consumed**, required when enabled, **secret** | The default user's password, used verbatim (surrounding whitespace is part of it). At least `PASSWORD_MIN_LENGTH` characters (`backend/src/auth/password-rules.ts`, the same constant `RegisterDto` uses). Never logged, including in boot errors. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_ADMIN` | **Consumed**, optional flag | When `true`, the default user is an admin; otherwise a regular user. Defaults to `false`. With automatic login on, **whoever receives the automatic login is an admin** (see [Admin access](modules/auth/default-user.md#admin-access)). | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_DEFAULT_USER_ALLOWED_IPS` | **Consumed**, optional | Comma-separated IPs and/or CIDR ranges allowed to receive the automatic login, e.g. `127.0.0.1,10.0.0.0/8,203.0.113.7`. Entries are trimmed and empty entries ignored. Empty or unset means loopback only (`127.0.0.1`, `::1`). IPv4-mapped IPv6 clients (`::ffff:a.b.c.d`) match as IPv4. See [IP allowlist](modules/auth/default-user.md#ip-allowlist). | `backend/src/auth/default-user.config.ts`, `backend/src/auth/default-user-allowlist.ts` |
| `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION` | **Consumed**, optional flag | Must be `true` for `ALWAYS_AUTHENTICATED` to boot when `STAGE=production` (the [production guard](modules/auth/default-user.md#production-guard)). Defaults to off. | `backend/src/auth/default-user.config.ts` |
| `KERGHAN_USER_APPROVAL_REQUIRED` | **Consumed**, optional flag | When `true`, new self-registrations start `pending` and need an admin approval; otherwise they start `approved`. Never changes existing users and never disables the `approved` requirement of the authentication gate. Defaults to off; any value other than exactly `true` leaves it off, like the other `KERGHAN_*` boolean flags. See [User approval](modules/auth/user-approval.md). | `backend/src/auth/user-approval.config.ts` |
| `STAGE` | **Consumed**, set to `production` in production | When exactly `production`: the demo-user seed migrations skip their work, and the default-user production guard applies. Unrelated to `NODE_ENV`; the standalone stack does not set it. | `backend/src/database/migrations/helpers.ts`, `backend/src/auth/default-user.config.ts` |

**Device-authorization tuning — undocumented-but-defaulted in dev.** None of the six
`KERGHAN_AUTHORIZATION_REQUEST_*` variables above (TTL plus the five rate-limit/cap/cool-off keys)
are set in `.env.dev.sample` — local dev runs entirely on their code-level defaults (see each
row above). Set them explicitly only if a deployment needs different tuning. The same applies to
the four numeric `KERGHAN_INTEGRATIONS_*` tuning variables (`MAX_PER_USER`,
`CREDENTIAL_MAX_ATTEMPTS`, `CREDENTIAL_LOCK_MS`, `TEST_COOLDOWN_MS`); only
`KERGHAN_INTEGRATIONS_KEY` is set in the sample, because it has no default (alongside an empty
`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`, which only matters during a rotation).

### Default user: values and boot validation

The eight `KERGHAN_DEFAULT_USER_*` variables are read only by `DefaultUserConfig`; the behavior
they drive is in [Default user and automatic login](modules/auth/default-user.md). None is set in
`.env.dev.sample`, so the feature is off in local dev and in production unless set explicitly.

- **Flag values.** A flag (`ENABLED`, `ALWAYS_AUTHENTICATED`, `ADMIN`, `ALLOW_IN_PRODUCTION`) is
  on only when its value is exactly the string `true`, like `KERGHAN_EMAILS_ENABLED`. Anything
  else (`TRUE`, `1`, `yes`, ` true`, empty, unset) is off; flags are not trimmed.
- **Value handling.** `USERNAME` and `EMAIL` are trimmed. `ALLOWED_IPS` is split on `,`, each
  entry trimmed and empty entries ignored. `PASSWORD` is used verbatim.
- **"Enabled"** means `ENABLED` **or** `ALWAYS_AUTHENTICATED` is on.
- **Boot validation.** When enabled, boot fails, with one error naming every offending variable
  (or, for the allowlist, the offending entry) and never the password, when:
  - `USERNAME`, `EMAIL` or `PASSWORD` is missing or empty (so automatic login without credentials
    never boots);
  - `EMAIL` is not a valid email;
  - `PASSWORD` is shorter than `PASSWORD_MIN_LENGTH`;
  - `ALLOWED_IPS` has a malformed entry (a valid entry is a bare IP, or `ip/prefix` with an
    integer prefix of 0–32 for IPv4 or 0–128 for IPv6; IPv6 zone ids are malformed);
  - `STAGE=production`, `ALWAYS_AUTHENTICATED` is on and `ALLOW_IN_PRODUCTION` is not `true`.
    `ENABLED` alone boots in production without it.
- **When disabled,** no check runs at all (including `ALLOWED_IPS` and the production guard).
- Boot also fails when the configured email belongs to another user (see
  [Boot sync](modules/auth/default-user.md#boot-sync)).

Example (placeholder values only):

```bash
KERGHAN_DEFAULT_USER_ENABLED=true
KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_DEFAULT_USER_USERNAME=admin
KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local
KERGHAN_DEFAULT_USER_PASSWORD=example-password
KERGHAN_DEFAULT_USER_ADMIN=false
KERGHAN_DEFAULT_USER_ALLOWED_IPS=127.0.0.1,10.0.0.0/8
```

For standalone, the client writes and manages these values; see
[section 5](#5-standalone-darthjeekerghan-standalone).

### Setting `KERGHAN_INTEGRATIONS_KEY`

`KERGHAN_INTEGRATIONS_KEY` has no default, so the backend refuses to boot without a valid one.

- **Set it on the backend host (Render) before deploying.**
  Otherwise the new release fails to boot.
- Generate it with `openssl rand -base64 32`, which gives the base64 of exactly 32 random bytes.
- It must differ from `KERGHAN_SECRET_KEY`. Boot fails when the two are equal.
- The placeholder in `.env.dev.sample` (`a2VyZ2hhbi1kZXYtaW50ZWdyYXRpb25zLWtleS0zMmI=`) is public.
  Boot refuses it when `NODE_ENV=production`, so production must also set
  `NODE_ENV=production` for that guard to apply.
- Never just swap or drop it. If the key is lost, or changed without keeping the old one in
  `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`, every credential stored under it becomes `undecryptable`
  and each user has to replace it. To change it, follow "Rotating `KERGHAN_INTEGRATIONS_KEY`"
  below.
- Existing local `.env` files are not regenerated (`make` only copies the sample when `.env` is
  missing). Add the `KERGHAN_INTEGRATIONS_KEY=...` line from `.env.dev.sample` by hand.

### Setting up the GitHub OAuth App

`KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` enable the
`oauth_app` integration type (see
`docs/agents/modules/integrations/oauth-app.md#server-config`). Both are
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
integration type (see `docs/agents/modules/integrations/github-app.md#server-config`).
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

### Rotating `KERGHAN_INTEGRATIONS_KEY`

`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` keeps retired keys **decrypt-only**: new and replaced
credentials are always encrypted with the current key, and each stored row's `secret_key_id`
picks the key that decrypts it (see `docs/agents/modules/integrations.md#encryption-at-rest`).
Keys must not contain commas, and must not have leading or trailing whitespace (entries are
trimmed).

Rows under a previous key move to the current key in two ways:

- **Lazily**, whenever a test connection decrypts one.
- **Explicitly**, with `yarn integrations:keys:reencrypt` (`make integrations-keys-reencrypt` in
  dev). It prints `reencrypted=<n> skipped_undecryptable=<n> skipped_changed=<n>` and exits `1`
  when any row couldn't be decrypted. It is idempotent, so it is safe to run again.

`yarn integrations:keys:status` (`make integrations-keys-status` in dev) is read-only. It prints
one `<keyId> <current|previous|unknown> <count>` line per key id, so you can tell when a retired
key no longer protects any row. Neither command ever prints a key, a ciphertext or a secret. In
production (Render), `dist/` is already built: run them from a shell on the backend service.

**Routine rotation.** Use this only when the old key is *not* suspected to be compromised:

1. Generate a new key with `openssl rand -base64 32`.
2. Deploy with `KERGHAN_INTEGRATIONS_KEY=<new>` and `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<old>`.
   Existing credentials keep working; new ones are encrypted with `<new>`.
3. Once *every* backend instance runs the new config, run `yarn integrations:keys:reencrypt`.
4. Run `yarn integrations:keys:status` and confirm the old key id shows `0`.
5. Deploy again with `<old>` removed from `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`.

If Kerghan runs several backend instances behind a rolling deploy, an instance still on the old
config can't decrypt a row that a new instance already re-encrypted (lazily, on a test
connection) or encrypted with `<new>`. Use three phases instead: (a)
`KERGHAN_INTEGRATIONS_KEY=<old>`, `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<new>`, so every instance
can read `<new>` before any row uses it; (b) `KERGHAN_INTEGRATIONS_KEY=<new>`,
`KERGHAN_PREVIOUS_INTEGRATIONS_KEYS=<old>`, then reencrypt and check the status; (c) remove
`<old>`.

**Compromised key.**

1. Rotate right away, keeping the leaked key in `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS` only long
   enough to re-encrypt, then run `yarn integrations:keys:reencrypt`.
2. Drop the leaked key as soon as `yarn integrations:keys:status` shows `0` for it.
3. Tell users to rotate their GitHub credentials (and replace them in Kerghan). Re-encrypting
   does not undo the exposure: anyone holding the leaked key and a copy of the old ciphertexts
   can still read them.

**Lost previous key.** Rows encrypted under a key that is no longer configured show as
`unknown` in `status` and are `undecryptable` until their owners replace the credential (or
delete the integration). `reencrypt` can't recover them.

**GitHub credentials — integrations only.** Issue fetching still reads public GitHub REST API
data unauthenticated (see `docs/agents/product.md`). User-supplied GitHub credentials are stored
only as integrations (`docs/agents/modules/integrations.md`), encrypted with
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
`upload_fe_files`, `release`, `release-kerghan-assets`), gated to semver tag pushes, requires
every variable below. No real Render service or SSH deploy host exists for Kerghan yet, though —
provisioning that infrastructure and filling in these values is a separate, not-yet-done step;
until then, a tag push runs the jobs but they fail against unset/placeholder credentials.

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
| `GITHUB_TOKEN` | Creates the GitHub release of the tag (when missing) and uploads the client/installer assets (`kerghan`, `install.sh`, `config.example`, `SHA256SUMS`). Needs `contents: write` on `darthjee/kerghan`; read by `gh` directly. | `bin/release_kerghan_assets.sh` (`release-kerghan-assets` CI job) |
| `CODACY_PROJECT_TOKEN` | Coverage upload target, read implicitly by Codacy's own uploader script. | `backend_tests`/`jasmine` CI jobs |

## 5. Standalone (`darthjee/kerghan-standalone`)

How the standalone image hands variables to its inner stack. Each backend variable's meaning is
defined in section 1; this section only says how standalone treats it. For the `kerghan` client
and the `~/.kerghan/` layout, see [standalone.md](standalone.md).

### How values flow

`~/.kerghan/kerghan.env` (passed by the `kerghan` client as `--env-file`), or `-e` /
`--env-file` on a plain `docker run` → the Vault container's environment → interpolation in the
inner compose file (`standalone/vault/docker-compose.yml`) → each inner service's
`environment:`. The inner compose file decides what each service receives. No secret is baked
into the image.

### Contract

| Group | Variables | Handling |
|---|---|---|
| Required secrets (no default) | `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` | Generated by the `kerghan` client on the first `up` (`openssl rand -base64 32`, into `kerghan.env`, mode 600), or supplied by the user. The backend fails to boot when either is missing or invalid. Back them up: see [standalone.md](standalone.md#caveats). |
| Internal, fixed by the stack | `NODE_ENV=production`, `PORT=3000`, `KERGHAN_MYSQL_HOST=mysql`, `KERGHAN_MYSQL_PORT=3306`, `KERGHAN_MYSQL_NAME=kerghan`, `KERGHAN_MYSQL_USER=kerghan`, `KERGHAN_EMAILS_ENABLED=false`; Tent's backend host `http://kerghan:3000/` | Literals in the inner compose file and the Tent standalone configuration, so they cannot be overridden from the Vault container. MySQL is never published outside the inner network. |
| Default user (defined in [section 1](#default-user-values-and-boot-validation)) | `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_USERNAME`, `KERGHAN_DEFAULT_USER_EMAIL`, `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_DEFAULT_USER_ADMIN`; `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, `KERGHAN_DEFAULT_USER_ALLOWED_IPS`; `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION` | Listed by name only in the `kerghan` service's `environment:`. On a new installation the `kerghan` client writes `ENABLED=true`, `USERNAME=admin`, `EMAIL=admin@kerghan.local`, a generated `PASSWORD` (`openssl rand -hex 24`) and `ADMIN=true` to `kerghan.env`; existing files are not modified automatically; `kerghan update-env` adds the missing keys. `ALWAYS_AUTHENTICATED` and `ALLOWED_IPS` are client-managed: the client passes them with `-e` on every `up` (from `auto-login`, see [standalone.md](standalone.md)); `kerghan up` refuses a `kerghan.env` that sets either one. A `kerghan.env` without `USERNAME`, `EMAIL` and `PASSWORD` keeps the default `auto-login` off. `ALLOW_IN_PRODUCTION` is a plain pass-through. |
| Overridable, with a default | `KERGHAN_MYSQL_PASSWORD` (default `kerghan`, also used as MySQL's `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`) | The value is fixed when the data volume is first initialized: an override only applies to a fresh volume, unless it is also changed inside MySQL. |
| Optional pass-through (allowlist) | `FRONTEND_BASE_URL`, `KERGHAN_ALLOWED_ORIGINS`, `KERGHAN_LOG_LEVEL`; `KERGHAN_ACCESS_TOKEN_TTL_MS`, `KERGHAN_REFRESH_TOKEN_TTL_MS`, `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`, `KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS`; `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS`, `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_LOCK_MS`, `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS`, `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT`, `KERGHAN_AUTHORIZATION_REQUEST_CREATE_WINDOW_MS`, `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER`; `KERGHAN_ACCOUNT_EDIT_LOCK_MS`, `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS`; `KERGHAN_INTEGRATIONS_MAX_PER_USER`, `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS`, `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS`, `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`; `KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID`, `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET`; `KERGHAN_GITHUB_APP_ID`, `KERGHAN_GITHUB_APP_SLUG`, `KERGHAN_GITHUB_APP_CLIENT_ID`, `KERGHAN_GITHUB_APP_CLIENT_SECRET`, `KERGHAN_GITHUB_APP_PRIVATE_KEY`; `KERGHAN_PREVIOUS_SECRET_KEYS`, `KERGHAN_PREVIOUS_INTEGRATIONS_KEYS`; `KERGHAN_USER_APPROVAL_REQUIRED` | Listed by name only in the `kerghan` service's `environment:`, so each reaches the backend only when it is set (an unset one is absent, not empty). Add them to `~/.kerghan/kerghan.env` (by hand or with `kerghan configure KEY=value`, see [standalone/client-config.md](standalone/client-config.md)), then run `kerghan down && kerghan up`. |
| Standalone / Vault level | The host port (client `-p` / `port=`, or `docker run -p <port>:80`), `VAULT_DOCKERD_TIMEOUT`, `COMPOSE_UP_ARGS` | Read by Vault or the client, not by the backend. The offline variant bakes `COMPOSE_UP_ARGS="--pull never"`. Not secrets. |
| Excluded | `KERGHAN_EMAIL_*`, `KERGHAN_DEMO_PASSWORD`, `KERGHAN_TRUSTED_PROXY_HOPS` | Email is out of scope for standalone. Without `KERGHAN_DEMO_PASSWORD`, the demo user's password falls back to a non-working placeholder (see [standalone.md](standalone.md#caveats)). `KERGHAN_TRUSTED_PROXY_HOPS` keeps its default (`1`), which matches the single Tent hop. |

**A variable not on the allowlist never reaches the backend**, even when it is set on the Vault
container. When the backend gains a new variable, add it to the `kerghan` service's
`environment:` in `standalone/vault/docker-compose.yml` (and to this table) in the same change,
or standalone users cannot set it.

### `FRONTEND_BASE_URL`

- The `kerghan` client passes `FRONTEND_BASE_URL=http://localhost:<port>` (the effective port)
  unless `kerghan.env` sets it. This makes `OriginGuard` trust that origin for browsers that do
  not send `Sec-Fetch-Site`, and gives the backend the base URL for password-reset links and the
  GitHub callback URLs (see [standalone.md](standalone.md#same-origin-and-originguard)).
- Plain `docker run` users set it themselves, for example
  `-e FRONTEND_BASE_URL=http://localhost:3000`.
- Because `NODE_ENV=production`, enabling the GitHub OAuth App or GitHub App types requires an
  `https` `FRONTEND_BASE_URL`, which in practice means running behind a TLS reverse proxy and
  setting `FRONTEND_BASE_URL` to its URL in `kerghan.env`.

## Keeping this doc honest

If you add code that reads a new `process.env.*` / `getenv()` value, or wire up a var currently
marked "Reserved, not yet read," update its row here in the same change — this doc is only useful
if it matches what the code actually does.
