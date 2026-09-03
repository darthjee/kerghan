# Rename the email env vars to KERGHAN_EMAIL_*

Rename the reserved Django-style email placeholders into the `KERGHAN_EMAIL_*` namespace (every
var the backend's own code reads is `KERGHAN_*`-prefixed) and add the new timeout var. This step
only touches `.env.dev.sample`; the `environment-variables.md` doc rewrite is Step 07.

Rename map (under the `# Email settings` block of `.env.dev.sample`):

| Old | New | Value to keep |
|---|---|---|
| `EMAILS_ENABLED` | `KERGHAN_EMAILS_ENABLED` | `false` |
| `EMAIL_HOST` | `KERGHAN_EMAIL_HOST` | `localhost` |
| `EMAIL_PORT` | `KERGHAN_EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | `KERGHAN_EMAIL_USER` | *(blank)* |
| `EMAIL_HOST_PASSWORD` | `KERGHAN_EMAIL_PASSWORD` | *(blank)* |
| `EMAIL_USE_TLS` | `KERGHAN_EMAIL_USE_TLS` | `true` |
| `DEFAULT_FROM_EMAIL` | `KERGHAN_EMAIL_FROM` | `no-reply@kerghan.local` |
| — | `KERGHAN_EMAIL_TIMEOUT_MS` (new) | `10000` |

- `FRONTEND_BASE_URL` (in the `# Frontend settings` block) is **not** touched — it is already
  consumed by `PasswordRecoveryRequestedEvent`'s `resetUrl` and is cross-cutting.
- Keep the `# Email settings` comment header and the block's position.

## Files to Change

- `.env.dev.sample` — rename the 7 email lines, add `KERGHAN_EMAIL_TIMEOUT_MS=10000`
