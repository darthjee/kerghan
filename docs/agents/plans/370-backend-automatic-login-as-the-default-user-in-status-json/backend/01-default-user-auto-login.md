# Default-user automatic login and boot warning

Extend `DefaultUserService` with a method such as `autoLogin(clientIp: string): Promise<AuthResult | null>`:

- Returns `null` when `config.isAlwaysAuthenticated()` is false, when `#defaultUserId` is `null`,
  or when `config.isIpAllowed(clientIp)` is false (an empty IP is not allowed).
- Otherwise loads the default user by `#defaultUserId` (`null` if the row is missing) and returns
  `tokenService.issueTokens(user, false)`: a regular session with the regular refresh TTL, never
  the persistent one.

Add the boot warning in `onApplicationBootstrap`, after the sync, when `isAlwaysAuthenticated()`
is true: a `logger.warn` with a prominent message (for example
`'AUTOMATIC LOGIN IS ON: status.json logs callers in as the default user'`) whose context carries
the default username and the effective allowlist. It must never include the password. Expose the
effective allowlist from `DefaultUserConfig` (for example an `allowedIps()` method returning the
configured entries, or the loopback defaults `127.0.0.1`, `::1` when none are configured), so the
warning shows what actually applies.

## Files to Change
- `backend/src/auth/default-user.service.ts` — add `autoLogin` and the boot warning.
- `backend/src/auth/default-user.config.ts` — expose the effective allowlist for the warning.
