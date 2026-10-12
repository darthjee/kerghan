# automatic-login.md

Create `docs/agents/specs/default-user/automatic-login.md` (implemented by #370).

**When automatic login applies.** When `isAlwaysAuthenticated()` is true, `POST status.json` logs the caller in as the default user and issues real cookies and a session, exactly as `login.json` does. It happens only when:
- there is no valid session (a valid access token or refresh cookie wins and follows the existing flow, including an explicit login as another user), and
- the client IP, resolved with the existing `KERGHAN_TRUSTED_PROXY_HOPS` handling, is in the allowlist.

A disallowed IP gets the normal unauthenticated response.

**What stays unchanged:**
- `JwtGuard` and the other protected endpoints. A request without a cookie still gets `401`.
- Logout. The next `status.json` logs in again.

**Boot and shutdown:**
- A prominent warning at every boot while the feature is on, naming the username and the effective allowlist, never the password.
- Turning the feature off does not revoke sessions it already created.

**Rejected alternatives** (record the rationale): a guard bypass with no tokens, and automatic login in the guard.

Leave the placeholder: "Response body, automatic-login indicator, cookie attributes and session metadata: to be defined by #375; do not implement before then."

**Required tests:**
- automatic login with no cookie from an allowed IP;
- no automatic login from a disallowed IP;
- an existing session wins, and refresh is preferred;
- protected endpoints still return `401` without a cookie;
- logout followed by automatic login;
- the boot warning, with no password in the logs.

## Files to Change
- `docs/agents/specs/default-user/automatic-login.md`: new.
