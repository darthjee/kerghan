# Add HealthService with the database check
Create `backend/src/health/health.service.ts`, an `@Injectable()` service holding the readiness logic so `HealthController` stays thin (per the repo boundary on thin controllers).

- Inject TypeORM's `DataSource` and the Core `LoggerService` (global via `LoggingModule`).
- Expose `checkReadiness(): Promise<{ status: 'ok' | 'error'; checks: { database: 'up' | 'down' } }>`.
- Database check: `await this.dataSource.query('SELECT 1')`. On success → `database: 'up'`. On any thrown error → `database: 'down'` and `logger.error(...)` with the error message as a structured attribute (never returned to the caller).
- `status` is `'ok'` only when every check is `'up'`; keep the checks map structured so more checks could be added later without changing the shape.
- Document the class and method with JSDoc in the same style as the rest of the backend.
- Register `HealthService` in `AppModule`'s `providers` (the controller is registered there directly; there is no `HealthModule`).

Spec `backend/src/health/tests/health.service.spec.ts` with a mocked `DataSource` and `LoggerService`:
- `query` resolves → `{ status: 'ok', checks: { database: 'up' } }`, no error logged.
- `query` rejects → `{ status: 'error', checks: { database: 'down' } }`, error logged, and the error message does not appear in the returned object.

## Files to Change
- `backend/src/health/health.service.ts` — new service with the DB readiness check.
- `backend/src/health/tests/health.service.spec.ts` — new spec for up/down paths.
- `backend/src/app.module.ts` — add `HealthService` to `providers`.
