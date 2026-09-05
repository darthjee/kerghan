# Backend Plan: Core logger service (level, structured attributes, console transport)

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add the injectable logger service](backend/01-add-logger-service.md)
- [02 — Register a global logging module](backend/02-register-global-logging-module.md)
- [03 — Document KERGHAN_LOG_LEVEL](backend/03-document-env-var.md)
- [04 — Unit specs](backend/04-add-unit-specs.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- No other specialist agent (frontend, infra, proxy, cache, security, data-access, product-owner)
  has work on this issue: no new endpoint, no auth/authz logic change, no response field change, no
  new entity, no infra/docker/proxy/cache config change. Purely `backend/src/core/`.
- Method-name reconciliation between scylla's `debug/info/warn/error` naming and NestJS's
  `LoggerService` interface naming (`log`/`warn`/`error`/`debug`/`verbose`, no `info`) is the one
  design wrinkle worth getting right in Step 1 — `log()` must map to the `info` level.
- This plan does not touch `mail.module.ts`, `mail.service.ts`,
  `password-recovery-requested.listener.ts`, or `main.ts` — migrating them onto this new service is
  #49 sub-issue #52 (`Migrate existing ad-hoc logging onto the Core logger service`), a separate
  planned issue.
