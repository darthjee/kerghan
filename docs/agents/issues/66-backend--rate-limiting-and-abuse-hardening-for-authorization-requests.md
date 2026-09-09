# Issue: Backend: rate-limiting and abuse hardening for authorization requests

## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issue 2 (create/poll endpoints) and #58 sub-issue 3 (approver-side endpoints).

The device-authorization flow (#58) intentionally lets anyone create an `open` request for any
username — that is required for the enumeration-safety contract. The trade-off is abuse surface:
an attacker can spam requests for a victim's username (noise on their Authorizations page), hammer
`create` to exhaust storage, or brute-force `authorize`. #58 lists these under "Edge cases &
risks" and defers the hardening to this sub-issue.

Today, `AuthorizationRequestService.create` already persists the requester's IP (`request_ip`,
via `extractClientRequestInfo`) and the entity already has an `expired` status value — no schema
groundwork is needed for those. `authorize` already returns a uniform `BadRequestException`
(`AUTHORIZE_FAILURE_MESSAGE`) for every failure branch, including a `DUMMY_DIGEST` timing-safe
compare when no approver row exists, so the existing enumeration-safety bar is already fairly
high; the hardening added here must not regress it.

## Problem

- `POST /auth/authorization-requests.json` is unauthenticated and unthrottled: unbounded rows per
  IP and per target username.
- A victim's `#/account/authorization-requests` page can be flooded with `open` rows.
- `POST /auth/authorization-requests/:uuid/authorize.json` has no attempt limit — a
  compromised-but-locked device could brute-force the approver's password.
- Neither DTO (`CreateAuthorizationRequestDto.username`, `AuthorizeAuthorizationRequestDto.password`)
  caps input length, so a flood/brute-force attempt can also be used to amplify per-request CPU
  cost (oversized values into the bcrypt compare path).

## Expected Behavior

- `create` is rate-limited per client IP and per target username (sliding window; limits from
  config). Over the limit → a uniform response that does not leak whether the username exists
  (either the same `{ uuid, pollToken, expiresAt }` shape backed by a throwaway row, or a
  consistent `429` applied identically for any username — decide during planning, but it must be
  enumeration-safe).
- The number of concurrent `open` rows per resolved user is capped (default e.g. 5); creating
  past the cap evicts the oldest `open` row (set it to `expired`) rather than rejecting, so a
  legitimate retry always works.
- `authorize` failures per approver (or per request) are counted; past a threshold within a
  window, further attempts are rejected with the same uniform `400` for a cool-off period.
- No implementation may reintroduce a side channel: normal creation, the per-IP-limited path, and
  the per-username-limited path must all do equivalent work and return the identical response
  shape/status with comparable timing (an attacker must not be able to fix one variable — IP or
  username — and binary-search the other to learn which limit fired). Likewise, once `authorize`
  is in cool-off, the rejection path must still perform an equivalent-cost dummy compare (or an
  artificial equal delay) rather than short-circuiting before the password check, so a locked-out
  attempt stays indistinguishable in timing/shape from an ordinary wrong-password attempt.
- Per-IP limiting trusts `X-Forwarded-For` only up to a configured number of trusted proxy hops
  (default: 1, matching today's single-Tent-hop deployment); a request arriving with more hops
  than trusted is resolved to the nearest untrusted hop's address rather than the client-supplied
  value, so a client hitting the backend directly (bypassing Tent) cannot spoof its way past the
  per-IP limit.
- All limits are `ConfigService`-driven with sane defaults; no new always-on infrastructure
  unless justified in planning.

## Solution

### Scope

Rate-limiting + concurrent-`open` cap + `authorize` brute-force protection for the
authorization-request endpoints, in `AuthorizationRequestService` (and/or a small dedicated
collaborator), plus config and tests.

Explicitly **out of scope**:

- A general-purpose rate-limiting framework for the whole app (if `@nestjs/throttler` or similar
  is introduced, keep its use scoped to these routes and document the decision).
- Physical purge of old resolved rows — still a separate follow-up per #58.
- Frontend copy beyond surfacing the existing error states from #58 sub-issues 6 and 7.
- Deployment/network-level changes (e.g. restricting direct host-port access to the backend) —
  the backend hardens itself against IP spoofing (see trusted-proxy-hops item below) instead of
  relying on network topology.

### What needs to be done

- Decide and document the mechanism in planning: in-service counting against
  `auth_authorization_requests` timestamps vs. a dedicated attempts table vs. `@nestjs/throttler`.
  Prefer the lightest option that stays enumeration-safe and needs no shared cache — confirmed in
  investigation: no rate-limiting mechanism, `@nestjs/throttler` dependency, or shared cache
  (Redis or similar) exists in the backend today, so this is genuinely a from-scratch decision.
- `AuthorizationRequestService.create` — enforce the per-IP and per-username create limits and
  the per-user concurrent-`open` cap (oldest-eviction). Keep the success-path response shape
  unchanged, and keep the limited-path timing/shape equivalent to the normal path (see Expected
  Behavior).
- `AuthorizationRequestService.authorize` — track failed attempts and enforce the cool-off;
  every rejection stays the uniform `400`, including during cool-off (equivalent-cost dummy
  compare, no short-circuit before the password check).
- Add a reasonable `@MaxLength` to `CreateAuthorizationRequestDto.username` and
  `AuthorizeAuthorizationRequestDto.password` so oversized input can't be used to amplify
  per-request cost.
- Harden client-IP resolution (`extractClientRequestInfo` / `client-request.ts`) with a new
  `ConfigService`-driven trusted-hop-count (or trusted-proxy-IP list) key, e.g.
  `KERGHAN_TRUSTED_PROXY_HOPS` (default `1`, final name/shape settled in planning), so
  `X-Forwarded-For` is only trusted up to that many hops — otherwise the resolved IP falls back to
  the nearest untrusted hop, closing the direct-port-bypass spoofing gap independent of
  deployment/network configuration.
- Config keys via `ConfigService`, e.g. `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT` /
  `…_CREATE_WINDOW_MS`, `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER`,
  `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS` / `…_AUTHORIZE_LOCK_MS` (final names
  settled in planning), following the existing `configService.get('KERGHAN_*', DEFAULT_CONST)`
  convention (e.g. `#ttlMs()` in `authorization-request.service.ts`). Defaults documented for #58
  sub-issue 9.
- Tests: extend `authorization-request.service.spec.ts` and
  `authorization-request.controller.e2e-spec.ts` — create over the per-IP limit and over the
  per-username limit; concurrent-`open` cap evicts the oldest rather than rejecting; repeated
  wrong-password `authorize` trips the cool-off; all rejections remain enumeration-safe / uniform
  `400` (or uniform `429` for create, applied identically for known and unknown usernames); add a
  timing/shape-equivalence assertion (or explicit code-path check) for the limited vs. normal
  paths.

### Acceptance criteria

- [ ] `create` is throttled per client IP and per target username via `ConfigService` limits;
      exceeding a limit produces an enumeration-safe response (identical for known and unknown
      usernames), with equivalent work/timing across the normal, per-IP-limited, and
      per-username-limited paths.
- [ ] The count of concurrent `open` requests per resolved user is capped; creating past the cap
      evicts the oldest `open` row instead of rejecting.
- [ ] Repeated failed `authorize` attempts trip a config-driven cool-off; rejections stay the
      uniform `400`, and the cool-off path performs equivalent-cost work so it isn't
      distinguishable by timing from an ordinary wrong-password rejection.
- [ ] `username`/`password` DTO fields have a reasonable max-length cap.
- [ ] Client-IP resolution trusts `X-Forwarded-For` only up to a config-driven number of proxy
      hops, so a request bypassing Tent and hitting the backend directly cannot spoof its way
      past per-IP limiting.
- [ ] All new limits are config-driven with documented defaults; no unjustified always-on
      infrastructure is added.
- [ ] Service + e2e specs cover each limit and assert enumeration safety; backend lint and tests
      pass.

## Benefits

- Closes the main abuse vectors the enumeration-safe design opens up, without weakening that
  design.
- Keeps a victim's Authorizations page usable under a flood, and blunts password brute-forcing on
  `authorize`.
- Config-driven, so limits can be tuned per environment.
