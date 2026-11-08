# sync.md and api.md: reconciliation and the handle-change knock-ons

`sync.md`: in "Sources" / "Handle credential", note that the run reads the handle through the
Auth export and reconciles first; add the mid-sync guard to the "Write path" step 1 for the
handle source; update "Pruning → When" and "Conditional requests → Invalidation" to the lazy
reconciliation; add required tests (handle changed mid-sync stops only the handle source and
writes nothing; reconciliation on sync start).

`api.md`: state that every route reconciles the handle before reading or writing
(listing, sync state, Refresh, Add); `sources[].handle` is the current, normalised handle;
`pending` for a newly set handle; the `fullName` owner rule links to the regex in `model.md`.
Add matching required tests. No new Repositories route.

## Files to Change

- `docs/agents/specs/repos/sync.md` — reconciliation, mid-sync guard, invalidation, tests.
- `docs/agents/specs/repos/api.md` — reconciliation on every route, handle field, tests.
