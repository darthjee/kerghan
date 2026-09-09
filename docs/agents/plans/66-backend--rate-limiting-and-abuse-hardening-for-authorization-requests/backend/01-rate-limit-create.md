# Rate-limit create per IP and per username

Add per-client-IP and per-target-username sliding-window rate limiting to
`AuthorizationRequestService.create`. Implement it as in-service counting: before inserting the new row,
count existing `auth_authorization_requests` rows matching `request_ip = <ip>` (or `username = <username>`)
with `created_at` within the configured window. If either count is at/over its configured limit, return the
over-limit response instead of creating a real row.

The over-limit response must be enumeration-safe and cost/timing-equivalent to the normal-creation path —
whichever shape is chosen (throwaway `{ uuid, pollToken, expiresAt }` row, or a uniform `429`), it must be
applied identically regardless of whether the username actually exists, and must do equivalent DB work to
the normal path (an attacker must not be able to fix one variable — IP or username — and binary-search the
other to learn which limit tripped).

Add two `ConfigService`-driven keys (module-level default constants, read via
`configService.get('KERGHAN_*', DEFAULT)`, following the existing `#ttlMs()` pattern): the create
limit count and its window in ms. Keep the success-path response shape unchanged.

## Files to Change

- `backend/src/auth/authorization-request.service.ts` — add the per-IP/per-username count checks and
  over-limit handling to `create`; add the new config-reading private methods alongside `#ttlMs()`.
