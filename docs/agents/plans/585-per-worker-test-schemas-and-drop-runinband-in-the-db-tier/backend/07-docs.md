# Update the backend testing docs

Document the new DB-tier model:
- one schema per worker, `<prefix>_w<id>_test`;
- in the tier, `KERGHAN_MYSQL_NAME` is the base name;
- the admin env vars are read only by `globalSetup`;
- the narrow grant;
- `maxWorkers` fixed at 2 by default, and overriding it with `--maxWorkers`;
- running one file still works (worker 1);
- the serial fallback rule for specs that aren't parallel-safe.

Remove any wording that says the tier runs "in band" or uses one shared schema.

## Files to Change
- `docs/agents/architecture/backend/testing.md`: the DB-tier section.
- `docs/agents/modules/issues/testing.md`: fix any reference to a single schema or serial run.
- `docs/agents/modules/repositories/testing.md`: same.
