# security.md

Create `docs/agents/specs/default-user/security.md` (consumed by #368, #370 and #371).

Cover:
- **IP allowlist.** Semantics, the loopback default, CIDR support, proxy-hop resolution so a forged `X-Forwarded-For` cannot bypass it, and the use case of restricting automatic login to an office or VPN range in production.
- **Production guard.** `ALLOW_IN_PRODUCTION`, plus the boot warning.
- **Session flooding.** Why automatic login lives only in `status.json`: if the guard issued sessions, cookie-less clients would create unbounded refresh-token rows.
- **Credentials.** The password is never logged. The standalone generator produces 32+ random characters with `openssl rand`.
- **Admin access.** With `ADMIN=true`, anyone who receives the automatic login is an admin. That's intended for standalone; online deployments can set `ADMIN=false`.
- **Standalone exposure.** Bind to `127.0.0.1` by default while automatic login is on (details in standalone.md).
- **Sessions after turning it off.** They stay valid until they expire.

**Required tests:**
- a forged `X-Forwarded-For` beyond the trusted hops is ignored;
- production boot is refused without the confirmation variable;
- the password is absent from the logs.

## Files to Change
- `docs/agents/specs/default-user/security.md`: new.
