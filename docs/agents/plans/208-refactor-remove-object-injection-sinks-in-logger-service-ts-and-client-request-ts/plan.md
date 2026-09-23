# Plan: Refactor: Remove object-injection sinks in logger.service.ts and client-request.ts

Issue: [208-refactor-remove-object-injection-sinks-in-logger-service-ts-and-client-request-ts.md](../../issues/208-refactor-remove-object-injection-sinks-in-logger-service-ts-and-client-request-ts.md)

## Overview
Replace the four computed-key lookups Codacy flags under `security/detect-object-injection` — the two `console[level](...)` dispatches and the `LEVEL_RANK[level] >= LEVEL_RANK[this.threshold]` comparison in `LoggerService`, and the `hops[trustedIndex]` read in `extractIp` — with non-dynamic-key alternatives, behavior-unchanged.

See [backend.md](backend.md) for the full plan.
