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
- Outcomes of the edge cases are fixed in [edge-cases.md](edge-cases.md): conflicts (E6 to E11), duplicate jobs, crashes and shutdown (E13, E15, E16), rate limits (E17), exhausted retries and their recovery (E18), the no-credential and revoked-credential outcomes (E19 to E21) and non-approved users (E24); #488 owns the mechanics.
- A rate limit pauses calls for the credential until the reset and **does not count toward the retry limit**: it never sets `sync_failed` or loses a write (E17).
- A revoked, missing or read-only credential is not transient: the job stops with no retry loop, the marker is kept and the link shows sync failed with a credential reason (E19 to E21). Fixing the integration does not push by itself.
- Jobs make no GitHub call for a user who is not `approved`; markers stay and resume on approval (E24).
- Link states: `linked`, `gone` and `sync_failed` (with a reason) are stored, the rest (pending, rate limited, repository unavailable) are derived; `paused` is not a link state, the worker-side pause stays as E24, with the precedence of [github-link.md](github-link.md#link-states). #488 owns the `sync_failed` reasons and transitions.
- A gone link creates no marker and gets no push or refresh; it is left only by unlinking ([github-link.md](github-link.md#gone-transferred-and-repository-unreachable)).
- Reads and pushes of a linked issue address the repository by its GitHub id, so a rename or transfer never redirects and a `301` means the issue moved.
- Only title, body and state are stored, so only they can sync; the base snapshot exists for #488's conflict rules (it may be dropped for last-write-wins).

## Open questions

- [ ] Which fields are synced in each direction? (#488)
- [ ] Mechanics of the conflict rules (the outcome, newest timestamp wins per field, is fixed in [edge-cases.md](edge-cases.md), E6 to E11). (#488)
- [ ] The `sync_failed` reasons and transitions (the stored states are fixed in [github-link.md](github-link.md#link-states)). (#488)
- [ ] Staleness and when a refresh is triggered. (#488)
- [ ] Retry limits and cooldown values, and which integration is used when several can see the repository (the no-credential outcome is fixed in E19 and E20). (#488)

## Required tests

Tiers, fixtures and tags: [testing.md](testing.md).

- A restart does not lose a pending write `(db)`.
- A job that exhausts its retries marks the link failed `(engine)`.
- Job params and logs carry no secrets (the ids-only allowlist and the canary sweep of [testing.md](testing.md#security-verification)).
- A job for a deleted project or user is a no-op.
- A gone link creates no marker and gets no push or refresh (E1).
- Sync is refused while the repository is Unavailable and allowed while it is Unknown.
- Conflicts, duplicate jobs and crashes resolve as E6 to E11, E13, E15 and E16 of [edge-cases.md](edge-cases.md); the scripted-interleaving ones are `(race)`.
- A rate limit pauses calls and never sets `sync_failed` (E17); exhausted retries set it and each recovery path re-enqueues (E18).
- A revoked, missing or read-only credential stops the job and keeps the marker (E19 to E21); a non-approved user's job makes no call (E24).
