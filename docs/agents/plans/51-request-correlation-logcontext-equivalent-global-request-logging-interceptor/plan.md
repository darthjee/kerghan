# Plan: Request correlation: LogContext-equivalent + global request-logging interceptor

Issue: [51-request-correlation-logcontext-equivalent-global-request-logging-interceptor.md](../../issues/51-request-correlation-logcontext-equivalent-global-request-logging-interceptor.md)

## Overview

Add per-request correlation on top of #50's `LoggerService`: a Nest middleware mints a
UUID v4 `requestId` per request and runs the rest of the request inside an
`AsyncLocalStorage` store. `LoggerService` is made context-aware so any bare-injected
`LoggerService` automatically carries the active `requestId`, and a standalone `LogContext`
wrapper is provided for explicit attribute binding. The same middleware emits one `info`
access-log line per request (`method` / `path` / `statusCode` / `requestId` only) on
`res.on('finish')`, so it also captures requests rejected by the global guards (401 / 403).

All work is in `backend/` and owned by the `backend` agent.

See [backend.md](backend.md) for the full plan.
