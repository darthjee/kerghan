# Verify
Run, via `docker-compose` only:

- `docker-compose run --rm kerghan_tests yarn test` — every spec passes; compare the test count/names before and after (via `--verbose` or the summary) to confirm no behavior was dropped: the number of `it`s in the e2e specs should be unchanged, only their setup moved.
- `docker-compose run --rm kerghan_tests yarn lint` — no ESLint errors (300-line / complexity-10 limits, JSDoc on the new helper file, import ordering).
- `docker-compose run --rm kerghan_tests yarn coverage` — matches CI's `backend_tests`.

Skim each touched file once more for any leftover repeated request/assert block covered by the issue.

## Files to Change
- None (verification only).
