# Edge-case specs and allowlist

Write specs that cite each id in their `it` or `describe` text:

- **E66:** an id deleted before the issue lock goes to `notFound`, and the other ids apply. This is a `(db)` race spec.
- **E67:** bulk races a project deletion, in both orders. When the deletion wins, the call answers `404` and nothing is applied. When bulk wins, its changes apply and the queued T1 jobs no-op.
- **E68:** bulk races an attach, in both orders, serialized by the project lock.
- **E69:** two overlapping bulk calls with opposite states. There is no deadlock, the last commit wins, and each call reports its own outcome.
- **E70:** every id is unchanged or not found. The call answers `200`, makes no writes, markers or enqueues, and still consumes its weight.
- **E71:** linked issues with a paused integration, a missing credential or an Unavailable repository. The marker is written and a T1 is enqueued, as in a single Edit.
- **E72:** a `gone` link changes locally only, with no marker and no T1, and counts in `changed`.
- **E73:** a listed project with no open issues reads `openIssueCount: 0`. Add this citation to the existing `open-issue-count.db-spec.ts` or `projects.service.listing.db-spec.ts`.
- **E74:** a rate-limited bulk call applies nothing and consumes nothing, and a retry after `Retry-After` succeeds, using the `FakeClock`.

Put the races under `tests/races/` with `race-helpers.ts`. Then remove the E66 to E74 entries from `ALLOWLIST` in `edge-cases.coverage.spec.ts`, leaving only E25, and update its comment.

## Files to Change

- `backend/src/issues/tests/races/bulk-state.race.db-spec.ts`: new, for E66 to E69
- `backend/src/issues/tests/issues.service.bulk-state.db-spec.ts`: E70 to E72 and E74
- `backend/src/issues/tests/open-issue-count.db-spec.ts`: the E73 citation
- `backend/src/issues/tests/edge-cases.coverage.spec.ts`: the allowlist
- `docs/agents/specs/issues/testing.md`: the route count goes from 18 to 19, and the allowlist sentence changes
- `docs/agents/specs/issues.md`: align the #563 row with the issue's *Builds against* list
