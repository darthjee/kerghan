# Unit tests and spec update

Add `backend/src/auth/tests/default-user.config.spec.ts`, using a fake `ConfigService` like `mail.config.spec.ts` (`{ get: jest.fn((key) => values[key]) }`). Cover every item under "Required tests" in `configuration.md`, the configuration-side items in `security.md`, and the clarifications:

- `isEnabled()` for each `ENABLED` × `ALWAYS_AUTHENTICATED` combination (always-authenticated alone → true).
- Only the exact `'true'` turns a flag on: `'TRUE'`, `'1'`, `'yes'`, `''`, unset and `' true'` are off.
- `isAdmin()` is false when `ADMIN` is unset.
- Each missing/empty required value throws naming that variable, only when enabled. When disabled, nothing is required.
- Several problems at once are all named in one error.
- Invalid email throws. A password shorter than `PASSWORD_MIN_LENGTH` throws. A password of exactly that length passes.
- A malformed IP or CIDR (e.g. `300.1.1.1`, `10.0.0.0/33`, `::1/129`, `abc`, `10.0.0.0/x`) throws naming the bad entry.
- When disabled, a malformed `ALLOWED_IPS` and missing values do not throw.
- Empty/unset `ALLOWED_IPS` allows `127.0.0.1` and `::1` only, and rejects e.g. `10.0.0.1`.
- `::ffff:127.0.0.1` is allowed by the default list. An IPv4-mapped address matches an IPv4 CIDR (`::ffff:10.1.2.3` vs `10.0.0.0/8`).
- Single IPs and CIDRs, IPv4 and IPv6 (e.g. `2001:db8::/32`), match and reject correctly. A non-IP input returns false.
- Trimming: whitespace around username, email and allowlist entries is stripped, and stray commas are ignored. The password keeps surrounding whitespace.
- Production guard: `STAGE=production` + always-authenticated throws naming `KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION` without it, and boots with it. `ENABLED` only (not always-authenticated) in production boots without it.
- No thrown message contains the password: use a distinctive password value in failing configurations and assert it is absent from `error.message`.
- `RegisterDto` still enforces `PASSWORD_MIN_LENGTH` (extend an existing register spec, or add a small `class-validator` `validate` test).

Update `docs/agents/specs/default-user/configuration.md`:
- In "Validation at boot", state that no check runs when `isEnabled()` is false, including `ALLOWED_IPS`.
- Add a short "Value handling" note: the trimming rules and that flags are compared untrimmed.
- Under the IP-allowlist method, document the IPv4-mapped normalization.
- Mention that the password rule is the shared `PASSWORD_MIN_LENGTH` used by registration.
- Add the matching items to "Required tests".
- If `security.md`'s IP-allowlist section needs a line for the IPv4-mapped rule, add it there too.

## Files to Change
- `backend/src/auth/tests/default-user.config.spec.ts` — new unit tests.
- `backend/src/auth/tests/*register*.spec.ts` — only if a constant-usage assertion is added there.
- `docs/agents/specs/default-user/configuration.md` — the four clarifications and their required tests.
- `docs/agents/specs/default-user/security.md` — only if the IPv4-mapped note belongs there too.
