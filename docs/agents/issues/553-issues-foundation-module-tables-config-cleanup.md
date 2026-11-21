# Issue: Issues: foundation (module, tables, config, cleanup)

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. This issue builds the **foundation** of the feature: the module, the tables and the shared pieces every later issue relies on. It adds no route. The specs are the source of truth: this issue makes no product decision of its own, and a change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2). The implementation issues were spawned by #492.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/model.md` (all of it: module layout, the four tables, indexes, cleanup)
- `docs/agents/specs/issues/security.md#data-at-rest` and `docs/agents/specs/issues/security.md#logs-and-job-params` (data at rest, logs)
- `docs/agents/specs/issues/sync.md#configuration` (the config keys)
- `docs/agents/specs/issues/testing.md#fixtures` and `docs/agents/specs/issues/testing.md#security-verification` (seed builders, intruder user, static specs of the module skeleton)
- `docs/agents/specs/issues/edge-cases.md`: E4, E12, E14, E16 and E41 to E56 (model rows), E31 and E53 (cleanup and logs)

## Task

- The `issues` module and its four entities (`issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`) with their indexes.
- The migrations, named `<timestamp>-issues-<action>.ts`, created in the order of `model.md` and dropped in the reverse order, in the `Table`/`TableIndex` style (no raw SQL).
- All nine config keys of `sync.md#configuration`, with their defaults and validation, so later issues only read them. Update `docs/agents/environment-variables.md` in the same change.
- The `user.deleted` cleanup listener and the lock order of `model.md#cleanup`.
- The **single access check** (the one place that answers "this user's live project, or 404") that issues 3 to 6 use.
- The DB seed builders `seedProject`, `seedIssue`, `seedLink`, `seedMarker` and the intruder user of `testing.md#fixtures`.
- The static specs of `testing.md#security-verification` that apply to a module skeleton: no `fetch`, no `NOW(`, no Integrations or Auth mapping, the column allowlist (the marker has no payload column).

## Test scope

#553 owns only the **schema-level** Required tests of the files under *Builds against*:

- the migrations up and down;
- the unique keys (including the `uuid` indexes);
- `deleted_token` written together with `deleted_at`;
- utf8mb4 and `bigint` round-trips, and `datetime(3)` on `issues.updated_at`;
- the `user.deleted` cleanup in lock order, and a listener failure that is logged without blocking;
- the single access check;
- the two-user (intruder) baseline;
- the static specs of a module skeleton.

Each behavioural test moves to the issue that builds that behaviour:

- compare-and-clear, the marker upsert on edit and boot re-enqueue, to the sync issues;
- project deletion, single issue deletion, bulk state change and the open-issue count, to the route issues.

The edge-case rows follow the same split: #553 covers the rows it can exercise against the schema and the cleanup.

## Config reading

The existing `getNumberConfig` (`backend/src/core/numeric-config.ts`) accepts `0`, negative and fractional values. `sync.md#configuration` requires "positive integer; otherwise the default". #553 adds a new shared helper next to it in `core/` (e.g. `getPositiveIntConfig`) and reads the nine keys with it. `getNumberConfig` and its existing callers stay unchanged.

## Depends on

None. It can start at once, in parallel with the GitHub issue client issue.

## Acceptance criteria

- The schema-level Required tests of every spec file listed under *Builds against* (see *Test scope*) are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (default tier by category and the coverage per area).
- Migrations run up and down; the unique keys, `deleted_token`, utf8mb4, `bigint` and the cleanup queries are covered on the DB-backed tier with two users' rows.
- `docs/agents/environment-variables.md` lists the new keys in the same change that reads them.
- No decision differs from the specs; if one has to, the spec is updated in the same PR.
- The checks of the owning agent pass.

## Notes

Responsible agent: `backend`. Review: `security` and `data-access` (data at rest, access check, cleanup).
