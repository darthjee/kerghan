# Issues and Projects — Sync and workers

Two-way sync between a Kerghan issue and its linked GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

- Sync is two-way.
- Built on the in-process, in-memory queues from #479 (`WorkersService.register` / `enqueue`); this spec depends on #479.
- Triggers are on demand only.
- Outbound writes use a durable pending marker in the database, re-enqueued at boot, so a restart does not lose a pending write.
- Rate limits reuse `retryAfterSeconds`, with retry and cooldown. A job that exhausts its retries marks the link as sync failed.
- Jobs receive ids only. Credentials stay in the Integrations module and never appear in job params or logs.

## Open questions

- [ ] Which fields are synced in each direction? (#488)
- [ ] Conflict rules when both sides change. (#488)
- [ ] The full set of link states. (#488)
- [ ] Staleness and when a refresh is triggered. (#488)
- [ ] Behavior when no write-capable credential is available. (#488)

## Required tests

- A restart does not lose a pending write.
- A job that exhausts its retries marks the link failed.
- Job params and logs carry no secrets.
