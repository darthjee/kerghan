# configuration.md

Create `docs/agents/specs/default-user/configuration.md` (implemented by #368).

**Variables table** (name, meaning, default, required when):

| Variable | Meaning / default |
|---|---|
| `KERGHAN_DEFAULT_USER_ENABLED` | Create or synchronize the default user at boot |
| `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` | Automatic login. Implies `ENABLED` |
| `KERGHAN_DEFAULT_USER_USERNAME` | Required when enabled |
| `KERGHAN_DEFAULT_USER_EMAIL` | Required when enabled. Must be a valid email |
| `KERGHAN_DEFAULT_USER_PASSWORD` | Required when enabled. Must pass registration's password rules |
| `KERGHAN_DEFAULT_USER_ADMIN` | Default `false` |
| `KERGHAN_DEFAULT_USER_ALLOWED_IPS` | Comma-separated IPs/CIDRs. Empty or unset means loopback only (`127.0.0.1`, `::1`) |
| `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION` | Required `true` for always-authenticated when `STAGE=production` |

**Rules:**
- Only the exact string `true` turns a flag on, consistent with `KERGHAN_EMAILS_ENABLED`.

**`DefaultUserConfig`:**
- Lives in the auth module and is built once at boot.
- It is the only reader of these variables, following `buildMailConfig` in `backend/src/mail/mail.config.ts`.
- Methods:
  - `isEnabled()`: `ENABLED || ALWAYS_AUTHENTICATED`.
  - `isAlwaysAuthenticated()`
  - `username()`, `email()`, `password()`, `isAdmin()`
  - an IP-allowlist check.

**Fail-fast validation at boot**, naming the offending variable or entry:
- a missing or empty required value;
- an invalid email or password;
- a malformed IP or CIDR;
- production without `ALLOW_IN_PRODUCTION`.

When `isEnabled()` is false, the required-value checks are skipped. The password is never logged.

**Required tests:** cover every rule, each flag combination, the defaults, each failure message, and loopback-only for an empty allowlist.

## Files to Change
- `docs/agents/specs/default-user/configuration.md`: new.
