# Architecture — Backend: Testing

Part of [Architecture — Backend](../backend.md): the default (fake-repository) suite, the
DB-backed tier and the injected time source.

## Testing

The default suite (`yarn test`/`yarn coverage`, CI job `backend_tests`) never touches a database —
specs inject mocked/fake TypeORM repositories rather than hitting MySQL:

- **Unit specs** (`*.spec.ts`): plain `jest.fn()`-based repository doubles, service instantiated
  directly (no `TestingModule` needed when there's no DI graph to exercise).
- **e2e specs** (`*.e2e-spec.ts`): a real `INestApplication` built via `Test.createTestingModule`,
  with each entity's repository token overridden
  (`.overrideProvider(getRepositoryToken(Entity)).useValue(fakeRepo)`) by a small in-memory fake
  (array-backed `findOne`/`findOneBy`/`find`/`count`/`create`/`save`/`update`, plus a
  `createQueryBuilder().update()` stub), driven end-to-end via `supertest`. The single shared
  fake lives in `auth/tests/support/in-memory-repo.ts` (`createInMemoryRepo`/`matchesCondition`,
  understanding the `isNull`/`moreThan`/`ilike` find operators and auto-filling `createdAt` on
  insert); the auth e2e specs get it wired up via `auth/tests/auth.controller.e2e-test-support.ts`'s
  `buildTestApp()`. This exercises real controller/service/DTO-validation/guard behavior without a
  real database.
- **`LazyModuleLoader`-dependent specs**: need a real Nest application context
  (`NestFactory.createApplicationContext`), not a bare `Test.createTestingModule` — the loader's
  internals (module scanning) aren't fully wired by the lightweight testing container.

### DB-backed tier

A narrow tier runs on real MySQL (`mysql:8.4.11`), for SQL semantics the fakes cannot prove (atomic
claims, unique keys, transactions, conditional writes, column type round trips). Everything else
stays on the fakes.

- **Suffix and script:** `*.db-spec.ts`, run only by `yarn test:db` (`jest.db.config.ts`, which
  shares its base settings with `jest.config.ts` through the plain CommonJS `jest.base.cjs`),
  in parallel (see *Per-worker schemas*) and never with coverage. The default `testRegex` does not match
  `*.db-spec.ts`.
- **Node versions:** the CI image (Node 22.14) loads TS Jest configs through ts-node, the dev
  image (Node 22.21) through native type stripping. Neither can load a `.ts` config imported from
  another `.ts` config in this `"type": "module"` package, so shared config lives in `.cjs`.
  Likewise `globalSetup` resolves the source's `./x.js` imports to `.ts` by wrapping Node's
  CommonJS resolver, not with `module.registerHooks` (Node 22.15+).
- **Where:** locally via `docker-compose run --rm kerghan_db_tests` (`make db-tests`), against
  the throwaway `kerghan_mysql_test` service; in CI via the `backend_db_tests` job and its MySQL
  service container. Connection settings are the app's own `KERGHAN_MYSQL_*` vars.
- **Schema guard:** the tier refuses to start unless `KERGHAN_MYSQL_NAME` ends in `_test`.
- **Per-worker schemas:** in the tier, `KERGHAN_MYSQL_NAME` is the *base* name. Each Jest worker
  uses its own schema `<base without _test>_w<JEST_WORKER_ID>_test` (`kerghan_test` gives
  `kerghan_w1_test`, `kerghan_w2_test`, ...). The `worker-schema.ts` `setupFiles` hook overrides
  `KERGHAN_MYSQL_NAME` per worker before any spec code reads it, so harnesses keep reading the
  variable unchanged. Running a single spec file still works (it runs as worker 1).
- **Admin credentials and grant:** `KERGHAN_MYSQL_ADMIN_USER` / `KERGHAN_MYSQL_ADMIN_PASSWORD` are
  read only by `globalSetup` (it throws a clear error when either is missing) and are deleted from
  the environment in the workers, so specs never see them. With them `globalSetup` runs
  `CREATE DATABASE IF NOT EXISTS` for every worker schema and a narrow
  ``GRANT ALL ON `<prefix>\_w%\_test`.* TO '<KERGHAN_MYSQL_USER>'@'%'``; migrations then run as
  the app user, so every run proves the grant is enough.
- **Worker count:** `maxWorkers` is fixed at 2 in `jest.db.config.ts` (a percentage would follow
  `os.cpus()`, which reports the CI host's cores). Override it with
  `yarn test:db --maxWorkers=<n>`; `globalSetup` creates as many schemas as the resolved value.
- **Parallel-safety rule:** a spec must not depend on another file's data or timing. Make race
  specs deterministic (barriers, deferred promises), never just raise timeouts. A spec that cannot
  be made parallel-safe moves to a second `maxWorkers: 1` Jest project (serial fallback) and gets
  a follow-up issue.
- **Lifecycle:** `globalSetup` retries the connection for up to 60 s, creates the worker schemas,
  then runs every migration on each of them in parallel, loaded from the TypeScript sources
  (`database/tests/db-tier/`). Before each test, every table except `migrations` is emptied with
  `DELETE` (seeded rows included), so each test starts empty. Specs get the file's shared
  connection from `getTestDataSource()`. `worker-schema.db-spec.ts` is the isolation canary.

See `database/tests/db-tier.db-spec.ts` for the smoke spec.

### Injected time source

Time rules read the injected `Clock` (`core/clock.ts`: `Clock#now()`, with `SystemClock` in
production and a `FakeClock` under `core/tests/support/` in specs), never `Date.now()` or
`new Date()` directly, so tests move time with `set` / `advance` and never wait. The Integrations
module (installation-token cache, unauthenticated budget tracker) and the
[Repositories module](../../modules/repositories/sync/execution.md#time-source) both use it. Time **conditions
in SQL** (a lease, a cooldown, a staleness check) compare against a value computed from the
`Clock` and passed as a parameter: never `NOW()` or `CURRENT_TIMESTAMP` in the statement.
