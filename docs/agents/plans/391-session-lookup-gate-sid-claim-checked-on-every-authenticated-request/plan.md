# Plan: Session-lookup gate: sid claim checked on every authenticated request

Issue: [391-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md](../../issues/391-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md)

## Overview
Add a `sid` claim (the refresh-token session's `sessionUuid`) to every access token, and make
`JwtGuard` check, on every non-`@Public()` request, that this session is active and belongs to
`sub`, building `request.user` from the DB user row. The lookup is reached through a
`core/`-defined abstraction implemented by `AuthModule`, so `core/` keeps never importing
`auth/`. Backend only; no status logic (#392) and no doc caveat rewrites (#394).

See [backend.md](backend.md) for the full plan.
