# Add the injectable logger service

Create a new Core-layer, constructor-injectable logger service in `backend/src/core/` — no static
facade, no direct `process.env` access (mirrors `core/cache-token.service.ts`'s use of
`ConfigService`).

The service exposes:

- `debug(message: string, attributes?: Record<string, unknown>)`
- `info(message: string, attributes?: Record<string, unknown>)`
- `warn(message: string, attributes?: Record<string, unknown>)`
- `error(message: string, attributes?: Record<string, unknown>)` — plain attributes object like the
  others, no special-cased `Error`-instance handling; a caller with a caught exception extracts
  `message`/`stack` itself and passes them as attributes.

Level filtering mirrors scylla's `BaseLogger#shouldLog`: a fixed ordinal map
`{ debug: 0, info: 1, warn: 2, error: 3 }`, and a message is only emitted when its level's rank is
at or above the configured threshold's rank. The threshold is read once (constructor time) from
`ConfigService.get<string>('KERGHAN_LOG_LEVEL', 'info')`.

The console transport is `console[level](message, attributes)` — attributes passed as a second
argument, not JSON-stringified into the message (mirrors scylla's `ConsoleLogger`). Map `debug` →
`console.debug`, `info`/`warn`/`error` → their same-named `console` methods.

**Also implement NestJS's `LoggerService` interface** (`import { LoggerService } from
'@nestjs/common'`), so this service could later be passed to `app.useLogger()` if a future change
wants Nest's own internal framework logging redirected through it too (not wired that way by this
plan — interface-compatible only). Nest's interface methods (`log`, `error`, `warn`, `debug`,
`verbose`) don't line up 1:1 with the `debug/info/warn/error` surface above — reconcile explicitly:

- `log(message, ...optionalParams)` → routes to this service's `info` level.
- `error`, `warn`, `debug` → route directly to the same-named method above.
- `verbose`, `fatal` (both optional on the interface) → can be omitted, or `verbose` routed to
  `debug` if implemented, since scylla's level map has no equivalent tier for either.

Don't reshape the primary `debug/info/warn/error(message, attributes)` API to match Nest's
`(message, ...optionalParams: any[])` signature — implement both surfaces on the same class rather
than collapsing to one, so application code keeps the structured-attributes-object ergonomics
while the class still satisfies `LoggerService` structurally.

## Files to Change

- `backend/src/core/logger.service.ts` (new) — the service itself, as described above.
