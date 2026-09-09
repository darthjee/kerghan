# Harden client-IP trust and DTO length caps

**Client-IP trust.** `extractClientRequestInfo` (`backend/src/core/client-request.ts`) currently resolves
the client IP from `X-Forwarded-For` with no hop limit, trusting Tent's `SetClientIpMiddleware` to have
set it correctly. Since the backend's container port is also reachable directly (bypassing Tent in some
deployments), harden IP resolution to only trust `X-Forwarded-For` up to a configured number of proxy
hops (default `1`, matching today's single-Tent-hop deployment — this changes nothing until
reconfigured). Beyond the trusted hop count, fall back to the nearest untrusted hop's address (or the
raw socket address if there's only one hop) instead of the attacker-supplied value.

`extractClientRequestInfo` is a plain utility function outside NestJS DI, so the trusted-hop count must be
threaded in from a caller that can inject `ConfigService` (e.g. the controller passes the resolved count
down, or the utility gains a small config-reading helper it can call directly) — pick whichever keeps
`client-request.ts` easily unit-testable; add a `KERGHAN_TRUSTED_PROXY_HOPS`-style config key (default
constant + `configService.get`, same convention as prior steps).

**DTO length caps.** Add a reasonable `@MaxLength` to `CreateAuthorizationRequestDto.username` and to
`AuthorizeAuthorizationRequestDto.password`, sized to comfortably fit real usernames/passwords while
rejecting oversized values before they reach the bcrypt-adjacent compare path.

## Files to Change

- `backend/src/core/client-request.ts` — add trusted-hop-count-aware IP resolution.
- `backend/src/auth/authorization-request.controller.ts` — thread the trusted-hop config through to
  `extractClientRequestInfo`, if that's the chosen approach.
- `backend/src/auth/dto/create-authorization-request.dto.ts` — add `@MaxLength` to `username`.
- `backend/src/auth/dto/authorize-authorization-request.dto.ts` — add `@MaxLength` to `password`.
