# DefaultUserConfig class

Create `backend/src/auth/default-user.config.ts` exporting the `DefaultUserConfig` class and a builder, modeled on `buildMailConfig`.

Construction:
- A static `DefaultUserConfig.fromConfigService(configService: ConfigService)` (or an exported `buildDefaultUserConfig`) reads all variables once:
  - flags (`ENABLED`, `ALWAYS_AUTHENTICATED`, `ADMIN`, `ALLOW_IN_PRODUCTION`): `configService.get(name) === 'true'`, untrimmed;
  - `USERNAME`, `EMAIL`: trimmed (`?? ''`);
  - `PASSWORD`: verbatim (`?? ''`);
  - `ALLOWED_IPS`: split on `,`, trim each entry, drop empty entries;
  - `STAGE`: read to evaluate the production guard.
- When `isEnabled()` (`ENABLED || ALWAYS_AUTHENTICATED`) is false, skip all validation and return a disabled instance.
- When enabled, collect every problem into a list, then throw one `Error` naming all of them (prefix like `default-user: ...`), as `throwIfInvalid` does in mail:
  - missing/empty `KERGHAN_DEFAULT_USER_USERNAME`, `_EMAIL`, `_PASSWORD` (name each);
  - `_EMAIL` fails `isEmail` from `class-validator` (only when non-empty);
  - `_PASSWORD` shorter than `PASSWORD_MIN_LENGTH` (only when non-empty);
  - each malformed `ALLOWED_IPS` entry, naming the entry: valid forms are a bare IP (`isIP(x) !== 0`) or `ip/prefix` with a valid IP and an integer prefix in range (0–32 for IPv4, 0–128 for IPv6);
  - production guard: `STAGE === 'production' && alwaysAuthenticated && !allowInProduction`, naming `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION`.
- Build a `net.BlockList` from the entries (`addAddress` / `addSubnet` with the right family). When the list is empty, add only `127.0.0.1` (ipv4) and `::1` (ipv6).

Methods (instance stays immutable after construction; keep fields private, e.g. `#password`):
- `isEnabled()`, `isAlwaysAuthenticated()`, `username()`, `email()`, `password()`, `isAdmin()`.
- `isIpAllowed(ip: string): boolean`: trim; if it matches `::ffff:a.b.c.d` (case-insensitive) with a valid IPv4 tail, check that IPv4 address; otherwise use `isIP` to pick the family and call `blockList.check(ip, family)`. Return `false` for anything that is not a valid IP.

The password must never be interpolated into an error or log message.

## Files to Change
- `backend/src/auth/default-user.config.ts` — new; `DefaultUserConfig` and its builder, with JSDoc in the style of `mail.config.ts`.
