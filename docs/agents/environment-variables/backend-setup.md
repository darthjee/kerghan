# Backend Setup: Default User, Keys and GitHub Apps

[Back to Environment Variables](../environment-variables.md)

## Default user: values and boot validation

The eight `KERGHAN_DEFAULT_USER_*` variables are read only by `DefaultUserConfig`; the behavior
they drive is in [Default user and automatic login](../modules/auth/default-user.md). None is set in
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
  [Boot sync](../modules/auth/default-user.md#boot-sync)).

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
[Standalone](standalone.md).

## Setting `KERGHAN_INTEGRATIONS_KEY`

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
  and each user has to replace it. To change it, follow [Rotating `KERGHAN_INTEGRATIONS_KEY`](key-rotation.md#rotating-kerghan_integrations_key)
  there.
- Existing local `.env` files are not regenerated (`make` only copies the sample when `.env` is
  missing). Add the `KERGHAN_INTEGRATIONS_KEY=...` line from `.env.dev.sample` by hand.

## Setting up the GitHub OAuth App

`KERGHAN_GITHUB_OAUTH_APP_CLIENT_ID` and `KERGHAN_GITHUB_OAUTH_APP_CLIENT_SECRET` enable the
`oauth_app` integration type (see
`docs/agents/modules/integrations/oauth-app/config-and-proxy.md#server-config`). Both are
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

## Setting up the GitHub App

`KERGHAN_GITHUB_APP_ID`, `KERGHAN_GITHUB_APP_SLUG`, `KERGHAN_GITHUB_APP_PRIVATE_KEY`,
`KERGHAN_GITHUB_APP_CLIENT_ID` and `KERGHAN_GITHUB_APP_CLIENT_SECRET` enable the `github_app`
integration type (see `docs/agents/modules/integrations/github-app/config-and-proxy.md#server-config`).
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

