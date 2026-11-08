# sync.md and model.md knock-ons

Resolve the #448 notes in `sync.md` and `model.md`, linking to `integrations.md` rather than
duplicating it.

**`sync.md`:**

- **Sources:** each integration is a source whatever its status; a non-usable one is not called
  and records `invalid_credentials` (status) or `error` (type disabled), keeping its rows (link
  `integrations.md` usable section).
- **Handle credential:** replace "which statuses count as usable is #448's" and the open note
  with the usable rule and the endpoint per source (link the endpoints table); a handle
  `not_found` maps to `error` for now (#450 may add a status).
- **Rate limits:** the tracker's home is settled (internal to the Integrations client, link);
  in-flight reservations; the sync threshold is ≤ 10 and Add's ≤ 0, so the 10 is a real reserve.
  Update the values table row for the threshold accordingly.
- **Pruning / write path:** add the end-of-sync safety net — before pruning, drop the source,
  page and status rows of any `integration:<id>` key no longer among the user's integrations.
- **Required tests:** add the safety-net test and the two-threshold test.

**`model.md`:**

- **Logical foreign keys:** replace the open note with the `integration.deleted` event (awaited,
  after the delete commits, best-effort) and link the sync safety net.

## Files to Change
- `docs/agents/specs/repos/sync.md` — sources, handle credential, rate limits, values table, safety net, required tests.
- `docs/agents/specs/repos/model.md` — deletion-hook mechanism.
