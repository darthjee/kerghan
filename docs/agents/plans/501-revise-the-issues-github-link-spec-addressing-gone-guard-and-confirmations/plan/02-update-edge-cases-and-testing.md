# Update edge-cases.md and testing.md

Keep the matrix an index of the rules written in step 1.

- **`edge-cases.md`:** add row E65 (a `301` on a read or push: rename, transfer, unclassifiable `Location`, second `301`) in the GitHub issue and link group; update E1 (add the `(race)` check for an edit against the job that sets `gone`), E22 (the issues probe, not a repository read), E61 (stale `updated_at` confirmation refused with `409` and the current differences; base equals local after creation) and E64 if its wording changes for the repeat-unlink refusal; change the range statement `E1…E64` to `E1…E65`; extend every "E57 to E64" range to "E57 to E65"; give E65 a tier (unit on the Integrations client for the classification, plus the contract spec) and add E1's `(race)` tier entry.
- **`testing.md`:** replace the "Id-based path contract spec (required)" bullet with the redirect and `Location` contract spec (records `200`, `404`, `410`, `301`, the rename `Location`; runnable against live GitHub on demand; the transfer `Location` still to be recorded); adjust the Link row of the tier table if it cites E57 to E64.

## Files to Change
- `docs/agents/specs/issues/edge-cases.md` — E65, updated E1, E22, E61 (and E64 if needed), ranges and tier lists.
- `docs/agents/specs/issues/testing.md` — contract spec bullet and the Link tier row.
