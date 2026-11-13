# Issue: Repositories: Infra — DB-backed test tier and MySQL CI job

## Description

Part of Epic #444 (repositories listing), implementation slice **C**. It adds the **DB-backed test tier**: a narrow set of `*.db-spec.ts` backend specs that run against real MySQL, locally and in CI. It also aligns dev, test and CI on **`mysql:8.4.11`**, the version production runs.

Spec: `docs/agents/specs/repos/testing.md#db-backed-tier` (and `#tiers`, `#default-tier-by-category`).

**Depends on:** nothing. It can run in parallel with #460 and #461.
**Blocks:** #463 (Repositories module). #463's claim, unique-key, transaction, compare-and-set, pruning and migration tests need this tier.
**Follow-up:** #469 moves the standalone image to 8.4.11. It is out of scope here.

## Problem

Backend specs today run only on fakes, and CI has no database. `architecture/backend.md#testing` defers adding a MySQL service "until the first spec actually needs a real database". The repositories sync engine is that first need.

The MySQL versions also disagree:
- production runs 8.4.11;
- dev compose and standalone run `mysql:9.3.0`;
- the spec asks for MySQL 8 with `cimg/mysql:8.0`.

## Expected Behavior

- `*.db-spec.ts` files are excluded from the default `yarn test`. A new `yarn test:db` runs them:
  - serially (`--runInBand`);
  - on the dedicated `kerghan_test` schema;
  - with every migration applied once per run;
  - with every table except TypeORM's `migrations` table truncated before each test.
- `yarn test:db` adds no coverage to the default `coverage`/Codacy report.
- Locally, `docker-compose` runs the tier against a new throwaway **`kerghan_mysql_test`** service (`mysql:8.4.11`, tmpfs, `MYSQL_DATABASE=kerghan_test`), never on the host. It never touches dev data.
- The dev `kerghan_mysql` service moves from `mysql:9.3.0` to `mysql:8.4.11`.
- CircleCI gets a DB-tier job with a `mysql:8.4.11` service container that runs `yarn test:db`. The release and deploy jobs require it, as they require `backend_tests`.
- One smoke `*.db-spec.ts` proves the tier works: migrations apply, a write/read round trip succeeds, and the truncation leaves the next test empty. The tier lands green before #463 uses it.

## Solution

The infra agent owns CircleCI and `docker-compose.yml`. The backend agent owns:
- a separate Jest config (`jest.db.config.ts`);
- the `test:db` script;
- the DB-tier helpers under `backend/src/database/tests/` (data source, migrations, truncation).

Follow `testing.md#db-backed-tier`, with the decisions below.

### Decisions

- **MySQL 8.4.11 everywhere except standalone.** The test service, the CI service container and the dev `kerghan_mysql` all use the official `mysql:8.4.11` image, to match production. `testing.md` drops "MySQL 8" and `cimg/mysql:8.0`. Standalone moves in #469.
- **Dev data reset.** An 8.4 server will not start on the existing 9.3 `docker_volumes/mysql_data`. The PR description and `architecture/infra.md` give the one-time steps: stop the service, delete `docker_volumes/mysql_data`, start it again, run `yarn migration:run` through docker-compose. Changing the MySQL image means a new release.
- **Separate test service.** The local tier runs against `kerghan_mysql_test` (tmpfs), the counterpart of the CI service container. `testing.md`'s "against the existing MySQL service" is updated to match.
- **Truncate every table except `migrations`.** The truncation helper is generic, so #463 adds the Repositories tables without registering them. `testing.md`'s "the Repositories tables are truncated" becomes "every table but `migrations`".
- **Migrations come from source.** The tier's data source loads the TypeScript migrations under `src/database/migrations/[0-9]*.ts` through the Jest transform, not `dist/`.

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in. One exception: the MySQL-version and dev-reset notes in `architecture/infra.md` and the DB-tier note in `architecture/backend.md#testing` are updated here, because they describe infrastructure this PR changes.
- Every test this slice owns (the smoke `*.db-spec.ts` above) is written and passes, in both `yarn test:db` and the CI job; the default `yarn test` stays green and unchanged.

## Benefits

- #463 can prove claims, unique keys, transactions and compare-and-set on real SQL instead of a fake.
- Tests, dev and CI run the same MySQL version as production, so version-specific SQL behavior is caught before release.
- Dev data stays safe: the test tier uses its own throwaway service.
