# The reconcile in the issues sync service

Add `IssuesSyncService.reconcile(linkId, { lastAttempt }): Promise<ReconcileOutcome>`. The outcome is one of `done`, `requeue`, `stopped`, `transient` or `rate_limited(until)`. This is the core of `sync.md`.

1. **Guards, in order:**
   1. The link exists, is not `gone` and its project is live; otherwise a silent no-op.
   2. The owner is approved (`isApproved`); otherwise stopped, with the marker kept.
   3. The repository is not Unavailable or dangling (`projectSummaries`; Unknown is allowed); otherwise stopped.
   4. `IssueCandidates.resolve` returns candidates; otherwise `sync_failed` with `no_credential` or `credential_invalid`.
   5. Not every candidate is paused; otherwise join the earliest-reset waiting set and return `rate_limited`. Paused candidates are skipped from the walk.
2. **Candidate walk.** For each candidate, read the marker (revision `R`, `Tm`), the local values (L) and the base (B). Then run the conditional `GET` with the stored `etag` (`304` means G = B).
   - **Fall back to the next candidate, restarting from the `GET`,** only on `invalid_credentials`, a non-rate-limit `forbidden` or `integration_unusable`.
   - **When every candidate fails on credentials:** `sync_failed` with `forbidden` if any candidate answered `403`, else `credential_invalid`.
   - **A rate limit:** pause that integration, add the link to its waiting set and return `rate_limited`.
   - **Timeout, `5xx`, network error or an unclassifiable `301`:** return `transient`. On `lastAttempt`, set `sync_failed` with `retries_exhausted` and return `stopped` instead.
3. **Merge per field** (title, body, state) with the table of `sync.md#reconcile` (E6 to E9, E7's tie goes to Kerghan). The push diff holds only the fields left to push, and `state_reason` is never sent.
4. **Push:** `PATCH` through `IntegrationsGithubIssueWriter.updateIssue`, only with a non-empty diff (an empty diff makes no call, E8).
5. **Commit** in one transaction, in lock order:
   - The base takes the pushed values. `github_updated_at` takes the `PATCH`'s `updated_at` (or the `GET`'s when nothing was pushed). `last_synced_at` is set, and `etag` is stored from a `200` `GET` or nulled after a `PATCH`.
   - Pulled fields go to the issue and the base only if the revision is still `R`.
   - Then compare-and-clear. On a miss, re-read the marker: if it still exists, keep only the push effects and return `requeue` (E10, E41, T6); if it is gone (unlink or delete), return `done`.
   - A successful clear, or a success with no marker, sets `linked` with reason `NULL`. A refresh never clears a failure that belongs to an unsent write.
6. **`404` / `410`:** run the E22 probe with the same candidate.
   - The probe answers `200`: `gone` with `deleted`, and discard the marker.
   - The probe fails with `403` or `404`: `forbidden`.
   - The probe fails with `401`: `credential_invalid`.
7. **Transfer (`moved`, E2):** `gone` with `moved`.
8. **Rename (`renamedTo`, E65):** call the Repositories rename method, with no state change.
9. **Deleted project or user mid-flight (E44, E32):** the commit guard writes nothing and returns `done`.

Log safe fields only. Unit-spec the full reconcile table, guards, fallback, probe, rename and `sync_failed` transitions with `FakeIntegrationsGithubService`, `FakeClock` and the seeds. E7's "Kerghan newer", "GitHub newer" and tie are three clock settings.

## Files to Change

- `backend/src/issues/issues-sync.service.ts` (new) and `backend/src/issues/tests/issues-sync.service.spec.ts` / `.db-spec.ts`
- `backend/src/issues/issues.module.ts`: the provider
