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
  always `--runInBand` and never with coverage. The default `testRegex` does not match
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
- **Lifecycle:** `globalSetup` retries the connection for up to 60 s, then runs every migration
  once per run, loaded from the TypeScript sources (`database/tests/db-tier/`). Before each test,
  every table except `migrations` is emptied with `DELETE` (seeded rows included), so each test starts
  empty. Specs get the file's shared connection from `getTestDataSource()`.

See `database/tests/db-tier.db-spec.ts` for the smoke spec.

### Injected time source

Time rules read the injected `Clock` (`core/clock.ts`: `Clock#now()`, with `SystemClock` in
production and a `FakeClock` under `core/tests/support/` in specs), never `Date.now()` or
`new Date()` directly, so tests move time with `set` / `advance` and never wait. The Integrations
module (installation-token cache, unauthenticated budget tracker) and the
[Repositories module](../../modules/repositories/sync/execution.md#time-source) both use it. Time **conditions
in SQL** (a lease, a cooldown, a staleness check) compare against a value computed from the
`Clock` and passed as a parameter: never `NOW()` or `CURRENT_TIMESTAMP` in the statement.
