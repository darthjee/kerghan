# Issue: Add structured application logging (Log service + initial logging points)

## Description

Kerghan has no unified logging today — only scattered ad-hoc `new Logger(ClassName)` calls from
NestJS's built-in `Logger` in `backend/src/mail/mail.module.ts`, `backend/src/mail/mail.service.ts`,
and `backend/src/auth/events/password-recovery-requested.listener.ts`, plus a couple of raw
`console.warn`/`console.error` calls in `backend/src/main.ts` and two migrations. There is no
consistent level filtering, no structured attributes, and no way to correlate multiple log lines
back to the same request.

A sibling project, `darthjee/scylla`, has a mature Logger design (documented in
`~/messages/logs.md`) worth reusing conceptually: a `BaseLogger` (level threshold plus
`debug`/`info`/`warn`/`error` methods) with pluggable transports (`ConsoleLogger`, plus an optional
`BufferedLogger` for in-memory ring buffers), a `LoggerGroup` fan-out composite, and a `LogContext`
decorator that pre-binds fixed attributes (e.g. `{ jobId }`) onto every call so scoped code doesn't
have to repeat them.

Scylla's design sits entirely behind a **static facade** (`Logger.info(...)`, no DI,
`process.env.LOG_LEVEL` read directly inside the class). That shape is **explicitly rejected for
Kerghan**: it conflicts with Kerghan's documented DI-only rule
(`docs/agents/architecture/modular-pattern.md`: "Classes never read env vars or import global
state directly"). This issue adapts scylla's *concepts* (level threshold, transports, context
binding) into an injectable Nest provider, not its static-singleton implementation. Call this out
explicitly so the static-facade shape doesn't get reintroduced later as a "simplification."

## Problem

- No single logging mechanism: three different classes each instantiate their own NestJS `Logger`,
  and `main.ts`/two migrations fall back to raw `console.warn`/`console.error`. There is no shared
  level configuration, no shared formatting, and no shared way to attach structured attributes.
- No level control via configuration: whatever ad-hoc logging exists today has no environment-driven
  threshold — there's no way to quiet noisy/debug output in production or turn it up for
  troubleshooting without code changes.
- No request correlation: each of the 5 logging points described below (incoming requests, email
  sending, the email-enabled check, password-recovery requests, and the found/not-found outcome of
  password recovery) would otherwise produce isolated, uncorrelated log lines — there's no shared
  identifier tying a single request's log lines together into one traceable flow.
- No documented conventions for what's safe to log: without an explicit rule, it's easy for a future
  call site to log a secret (e.g. the `access_token` cookie, SMTP credentials) or to leave verbose
  logging on by default in production.

## Expected Behavior

Kerghan should have a single, DI-injected logging service used everywhere logging happens, with:

- A configurable level threshold (via `ConfigService`, not `process.env` directly) that defaults to
  `info` and can be overridden per environment.
- Structured attributes on every log call (not just a message string).
- A lightweight way to bind a fixed set of attributes (e.g. `{ requestId }`) onto a scope so that
  multiple log calls within the same request are correlated without repeating the attribute at
  every call site.
- Console output only, following the two conventions below at every call site:
  - **Never log secrets/tokens** — e.g. the `access_token` cookie, SMTP credentials — only
    hand-picked safe fields.
  - **Gate verbose/noisy logging behind `debug`** so it stays silent by default in production
    (`KERGHAN_LOG_LEVEL` defaults to `info`).

All existing scattered logging (the three `new Logger(X.name)` NestJS-Logger call sites and the
raw `console.warn`/`console.error` calls in `main.ts`) should migrate onto this new service, so
Kerghan ends up with one logging mechanism, not two parallel ones.

## Solution

### Scope

This issue covers:

1. A new **Core-layer** logging service (injectable, not a static facade) living in
   `backend/src/core/`, at the same tier as `core/cache-token.service.ts` per
   `docs/agents/architecture/modular-pattern.md`'s module classification (always resident at boot).
2. A `LogContext`-equivalent context-binding mechanism for correlating log lines within a request.
3. Migrating the existing scattered `new Logger(X.name)` call sites and raw `console.warn`/
   `console.error` calls onto the new service.
4. Adding the 5 initial logging points listed below.

Explicitly **out of scope**:

- **Scylla's static-facade pattern** (`Logger.info(...)` as a module-level singleton reading
  `process.env` directly). Rejected outright for Kerghan — see Description above. The new service
  must be constructor-injected like every other Kerghan provider.
- **Scylla's `BufferedLogger`/`LogRegistry` layer** — in-memory ring buffers, per-job/per-worker
  buffers, pagination. That machinery exists in scylla purely to back a web log viewer. Kerghan has
  no such viewer and isn't building one. This issue is about console logging with levels and
  structured attributes, nothing that stores or serves logs back out.
- **The concrete request-ID generation/propagation mechanism** (e.g. Nest middleware assigning a
  UUID per request vs. `AsyncLocalStorage` vs. a request-scoped provider). The context-binding
  *design* (a `LogContext`-equivalent that pre-binds attributes onto subsequent calls) needs to
  exist as part of this issue so the 5 logging points below are built against it from the start,
  but the specific propagation mechanism is an implementation decision left to the split-out
  sub-issue that implements it.
- Splitting the 5 logging points into their own sub-issues — this parent issue documents them
  together; a later `/arcanum-split-issue` pass breaks each into its own sub-issue.

### What needs to be done

- **Backend — Core logger service** (`backend/src/core/`):
  - Add an injectable logger provider (level threshold + `debug`/`info`/`warn`/`error` methods,
    structured attributes per call) modeled on scylla's `BaseLogger`/transport design, adapted to
    Nest's DI conventions.
  - Level threshold is read from `ConfigService` (e.g. `KERGHAN_LOG_LEVEL`, default `info`) —
    never `process.env` directly, consistent with every other Kerghan class.
  - Console transport only for this issue (mirrors scylla's `ConsoleLogger`); no buffered/queryable
    transport.
  - A `LogContext`-equivalent that pre-binds a fixed set of attributes (e.g. `{ requestId }`) onto
    every subsequent call made within that scope, so the logging points below can be correlated
    into one traceable flow per request.
- **Backend — migrate existing ad-hoc logging** onto the new Core logger service:
  - `backend/src/mail/mail.module.ts` (`new Logger(...)` in the constructor)
  - `backend/src/mail/mail.service.ts` (`new Logger(...)`, existing `debug`/`error` calls)
  - `backend/src/auth/events/password-recovery-requested.listener.ts` (`new Logger(...)`)
  - `backend/src/main.ts` (raw `console.warn`/`console.error`)
  - The two migrations currently using raw `console.warn`/`console.error` — leave migration-time
    logging as-is if pulling in a Nest-DI service isn't feasible in that context; otherwise migrate
    them too. (Left to implementation judgment since migrations run outside the normal Nest DI
    lifecycle.)
- **Backend — the 5 initial logging points**:
  1. **Incoming requests** — via a global Nest interceptor or middleware, not manual
     per-controller calls (explicitly rejected per-controller logging: it fights the project's
     thin-controllers convention and wouldn't automatically cover future modules). Log
     method/path/status only — never headers, so the `access_token` cookie never reaches a log
     line.
  2. **Email sending** — the outcome of each `MailService.send(...)` call. `mail.service.ts`
     already has `debug`/`error` NestJS-Logger calls for this; migrate them onto the new Core
     logger service.
  3. **Checks of the email-enabled flag, per send attempt** — every time `MailService` evaluates
     whether outbound mail is enabled/disabled before deciding to send, not just the existing
     one-time boot-time log in `mail.module.ts`'s constructor. This is new per-request behavior,
     gated at `debug` level.
  4. **Requests to recover a password** — the `POST /auth/recover.json` flow
     (`PasswordResetService`/the `password-recovery-requested` event).
  5. **Whether the user was found or not during password recovery** — include the submitted
     email/username in this log line. This is a deliberate, already-made decision: the standard
     anti-enumeration trade-off (logging the submitted identifier alongside the found/not-found
     outcome could act as an enumeration oracle if log access isn't tightly restricted) was
     weighed and the decision was made to include it anyway. Not an open question to revisit here.

### Acceptance criteria

- [ ] An injectable Core-layer logger service exists in `backend/src/core/`, constructor-injected
      like every other Kerghan provider — no static facade, no direct `process.env` access.
- [ ] The log level threshold is read from `ConfigService` (e.g. `KERGHAN_LOG_LEVEL`), defaulting
      to `info`.
- [ ] The logger supports structured attributes per call and a `LogContext`-equivalent that
      pre-binds a fixed set of attributes (e.g. `{ requestId }`) onto every call made within a
      scope.
- [ ] Console output only — no buffered/in-memory log registry is introduced.
- [ ] `mail.module.ts`, `mail.service.ts`, and `password-recovery-requested.listener.ts` no longer
      instantiate their own `new Logger(...)`; they use the new Core logger service instead.
- [ ] `main.ts`'s raw `console.warn`/`console.error` calls are migrated onto the new Core logger
      service.
- [ ] A global Nest interceptor or middleware logs method/path/status for every incoming request,
      without logging headers or the `access_token` cookie.
- [ ] `MailService.send(...)`'s outcome is logged via the new Core logger service.
- [ ] Every per-send check of the email-enabled flag is logged at `debug` level (not just the
      existing one-time boot log in `mail.module.ts`).
- [ ] The `POST /auth/recover.json` flow logs the password-recovery request.
- [ ] The password-recovery flow logs whether the submitted user was found or not, including the
      submitted email/username in that log line.
- [ ] No call site logs secrets or tokens (e.g. `access_token` cookie, SMTP credentials).
- [ ] Verbose/noisy logging is gated behind `debug` level, silent by default in production.

## Benefits

- Replaces scattered, inconsistent ad-hoc logging with one DI-friendly service, consistent with
  Kerghan's documented "no direct env/global-state access" rule.
- Makes the 5 initial logging points correlatable per request via the `LogContext`-equivalent,
  instead of isolated, uncorrelated log lines.
- Establishes clear, documented conventions (no secrets in logs, `debug`-gated verbosity) that
  future logging call sites can follow without relitigating them.
- Sets up a clean base for later sub-issues (per-logging-point implementation, request-ID
  propagation mechanism) without over-specifying implementation details this issue doesn't need to
  settle.
