## Description

Split from #49 (see that issue for the full design rationale). This sub-issue covers only the
foundational piece: a new, injectable Core-layer logging service — no call sites migrated onto it
yet, no interceptor, no request correlation. Those are separate sub-issues (#49 sub-issues 2-5)
that depend on this one.

Kerghan has no shared logging mechanism today — see #49's Description for the full picture of the
scattered `new Logger(ClassName)`/`console.warn`/`console.error` call sites this new service will
eventually replace.

A sibling project, `darthjee/scylla`, has a mature Logger design (documented in
`~/messages/logs.md`) worth reusing conceptually: a `BaseLogger` (level threshold plus
`debug`/`info`/`warn`/`error` methods) with a `ConsoleLogger` transport. Scylla's design sits
behind a **static facade** (`Logger.info(...)`, no DI, `process.env.LOG_LEVEL` read directly).
That shape is **explicitly rejected for Kerghan** — it conflicts with the documented DI-only rule
(`docs/agents/architecture/modular-pattern.md`: "Classes never read env vars or import global
state directly"). This sub-issue adapts scylla's *concepts* (level threshold, transport) into an
injectable Nest provider, not its static-singleton implementation.

Note on precedent: this sub-issue originally pointed at `core/cache-token.service.ts` as the model
for how a Core provider is registered, but that service is declared directly in
`AppModule.providers` and is not actually injected into any other module today (no other file
currently constructor-injects it) — it doesn't demonstrate cross-module DI. Since this new service
must be injectable from `MailModule` and `AuthModule` (consumed by #49 sub-issues 3-5), it needs a
registration mechanism those precedents don't provide — see "Global module registration" below.

## Problem

- No shared logging service exists to inject anywhere. Every class that wants to log either
  instantiates its own NestJS `Logger` or falls back to raw `console.*`.
- No level control via configuration: nothing reads a log-level threshold from environment
  configuration, so there's no way to quiet noisy/debug output in production or turn it up for
  troubleshooting without code changes.
- No structured attributes: existing log calls are message strings only, with no consistent way
  to attach structured context (e.g. `{ userId }`) to a log line.

## Expected Behavior

A new, constructor-injectable logging provider should exist with:

- A configurable level threshold, read from `ConfigService` (e.g. `KERGHAN_LOG_LEVEL`, defaulting
  to `info`) — never `process.env` directly, consistent with every other Kerghan class.
- `debug`/`info`/`warn`/`error` methods, each accepting a message plus an optional structured
  attributes object, matching scylla's literal signature — `error()` takes a plain attributes
  object like every other level; it does **not** special-case an `Error` instance. A caller that
  wants a caught exception's `message`/`stack` in the log extracts them itself and passes them as
  attributes.
- **Also implements NestJS's `LoggerService` interface** (`@nestjs/common`), so the service could
  later be passed to `app.useLogger()` if a future change wants Nest's own internal framework
  logging (route mapping, etc.) redirected through it too — not wired that way by this sub-issue,
  just interface-compatible. Nest's interface uses `log()`/`debug()`/`warn()`/`error()`/`verbose()`
  naming (no `info()`), which doesn't line up 1:1 with scylla's `debug/info/warn/error` naming —
  reconcile this explicitly (e.g. `log()` *is* the `info`-level method; `debug`/`warn`/`error` line
  up directly) rather than exposing two divergent method sets.
- A message is only actually emitted (to `console[level]`) when its level's rank is at or above
  the configured threshold's rank (mirrors scylla's `BaseLogger#shouldLog`: `debug: 0, info: 1,
  warn: 2, error: 3`).
- Console output only (mirrors scylla's `ConsoleLogger`) — no buffered/in-memory transport, no log
  registry, no query API. That layer exists in scylla purely to back a web log viewer Kerghan has
  no need for; explicitly out of scope here and for #49 as a whole.
- Registered via a `{ global: true }` Nest module (mirrors `JwtModule.registerAsync({ global: true,
  ... })`, already used in `app.module.ts`), imported once in `AppModule`, exporting the service —
  so `MailModule`/`AuthModule`/any future consumer can inject it with no per-module import.

## Solution

### Scope

This sub-issue is scoped to the service itself, in isolation:

- The injectable logger provider (level threshold + `debug`/`info`/`warn`/`error` + structured
  attributes + console transport), living in `backend/src/core/` — Core layer, always resident at
  boot, per `docs/agents/architecture/modular-pattern.md`'s module classification, at the same
  tier as `core/cache-token.service.ts` (a good structural precedent: a Core provider whose
  configuration comes from `ConfigService`, never `process.env` directly).
- Unit tests for the service itself (level filtering behavior, structured attributes reaching the
  console call, default level, level override via config).

Explicitly **out of scope** (left to other #49 sub-issues):

- Migrating any existing call site (`mail.module.ts`, `mail.service.ts`,
  `password-recovery-requested.listener.ts`, `main.ts`) onto this service.
- The `LogContext`-equivalent context-binding mechanism and the global request-logging
  interceptor/middleware (request correlation) — separate sub-issue, since it's the first real
  *consumer* of this service and needs its own design discussion (request-ID generation/
  propagation mechanism).
- Any of the 5 initial logging points from #49 (incoming requests, email sending, email-flag
  checks, password-recovery request, found/not-found outcome).
- Scylla's static-facade pattern and its `BufferedLogger`/`LogRegistry` layer — rejected outright
  for Kerghan, see #49's Description.

### What needs to be done

- Add the injectable logger service under `backend/src/core/` (module/class naming left to
  implementation, following the project's standard module structure conventions; name it something
  distinct from Nest's own `Logger` class from `@nestjs/common` to avoid confusion, e.g.
  `LoggerService` or `AppLogger`).
- Read the level threshold from `ConfigService` (new env var, e.g. `KERGHAN_LOG_LEVEL`, default
  `info` when unset) — document it in `docs/agents/environment-variables.md` alongside the other
  `KERGHAN_*` vars.
- Implement `debug`/`info`/`warn`/`error` methods with level-rank filtering and a console
  transport (`console[level](message, attributes)`, attributes passed as a second argument, not
  JSON-stringified into the message — mirrors scylla's `ConsoleLogger`). `error()` takes a plain
  attributes object like the others — no special-cased `Error`-instance handling.
- Also implement NestJS's `LoggerService` interface (`log`/`error`/`warn`/`debug`/`verbose`),
  reconciling its method names against the `debug`/`info`/`warn`/`error` surface above (`log()`
  maps to the `info` level) rather than exposing two separate, divergent APIs.
- Register the service via a new `{ global: true }` module (mirrors `JwtModule.registerAsync({
  global: true, ... })` in `app.module.ts`), imported once in `AppModule`, exporting the service —
  not a plain `AppModule.providers` entry like `core/cache-token.service.ts` (that pattern doesn't
  make a provider injectable from other modules; see the Description's note above).
- Unit specs covering: default level (`info`), level override via config, filtering behavior at
  each level, that structured attributes reach the console call correctly, that the Nest
  `LoggerService` interface methods are implemented and route to the same level-filtering/console
  behavior, and that the service is actually injectable from a different module (e.g. a throwaway
  test module importing the global logging module).

### Acceptance criteria

- [ ] A constructor-injectable logger service exists in `backend/src/core/` — no static facade, no
      direct `process.env` access anywhere in it.
- [ ] The log level threshold is read from `ConfigService` (e.g. `KERGHAN_LOG_LEVEL`), defaulting
      to `info` when unset, and documented in `docs/agents/environment-variables.md`.
- [ ] `debug`/`info`/`warn`/`error` methods exist, each accepting a message and an optional
      structured-attributes object; `error()` does not special-case an `Error` instance.
- [ ] The service also implements NestJS's `LoggerService` interface, with its method names
      reconciled against the `debug`/`info`/`warn`/`error` surface (`log()` = `info` level) rather
      than exposing two divergent APIs.
- [ ] A log call below the configured threshold produces no console output; a call at or above it
      does, with attributes passed through.
- [ ] Only a console transport exists — no buffered/in-memory transport or query API.
- [ ] The service is registered via a `{ global: true }` module, exported so any other module
      (`MailModule`, `AuthModule`, etc.) can inject it without importing anything beyond the normal
      `AppModule` bootstrap — verified by at least one spec injecting it from outside its own
      declaring module.
- [ ] Unit specs cover level filtering, the default level, a config-overridden level, attributes
      reaching the console call, and the Nest `LoggerService` interface methods.

## Benefits

- Gives every other #49 sub-issue a single, DI-friendly primitive to build on, instead of each
  reinventing its own ad-hoc logging.
- Establishes the level-threshold/`ConfigService` pattern once, correctly, so it's not
  relitigated per call site.
