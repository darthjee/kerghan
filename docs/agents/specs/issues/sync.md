# Issues and Projects — Sync and workers

Two-way sync between a Kerghan issue and its linked GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

- Sync is two-way.
- Built on the in-process, in-memory queues from #479 (`WorkersService.register` / `enqueue`); this spec depends on #479.
- Triggers are on demand only.
- Outbound writes use a durable pending marker in the database, re-enqueued at boot, so a restart does not lose a pending write.
- Rate limits reuse `retryAfterSeconds`, with retry and cooldown. A job that exhausts its retries marks the link as sync failed.
- Jobs receive ids only. Credentials stay in the Integrations module and never appear in job params or logs.
- Sync is refused while the project's repository is Unavailable and allowed while it is Unknown; pending writes stay in their markers under the normal retry and sync-failed rules ([projects.md](projects.md#linked-repository-unavailable-or-removed)).
- Creating a project and attaching a repository never sync or enqueue a job ([projects.md](projects.md#creation-paths)).
- A queued or in-flight job for a deleted project or user is a no-op (no error, no retry), and deleting a project discards its markers ([projects.md](projects.md#deletion)).
- GitHub work uses the project owner's integrations, whoever triggers it ([projects.md](projects.md#room-for-sharing-members-and-roles)).
- Marker rules ([model.md](model.md#issues_pending_writes-the-pending-marker)): coalesced with a revision and no payload, compare-and-clear, re-enqueued at boot oldest first, attempts kept in memory; exhausted retries set the link `status` to `sync_failed` and keep the marker.
- Only title, body and state are stored, so only they can sync; the base snapshot exists for #488's conflict rules (it may be dropped for last-write-wins).

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
- A job for a deleted project or user is a no-op.
- Sync is refused while the repository is Unavailable and allowed while it is Unknown.
