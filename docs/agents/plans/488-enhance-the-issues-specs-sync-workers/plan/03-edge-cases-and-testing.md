# Update edge-cases.md, testing.md and the issues.md index

`edge-cases.md`:
- Rows E5 to E11, E13, E15 to E21 and E24 move from `Contract` to `Decided`, with Rule links to the matching `sync.md` sections (E5/E21 to retries and `sync_failed`; E6 to E11 to reconcile; E13, E15, E16 to job and marker lifecycle; E17 to rate limits; E18 to retries; E19, E20 to integration selection; E24 to triggers).
- Reword E18 recovery: retry sync (resets to `linked` and enqueues), a later edit, or a restart.
- Reword E24: jobs make no GitHub call for a user who is not `approved`; markers stay until the user is deleted; `denied` is final, so nothing resumes them; a future un-deny must re-enqueue. Update its Check accordingly (no call; no listener).
- E55 (indexed row 15) stays indexed; its rule text lives in `model.md`.
- Open questions: remove the #488 item (retry values and integration selection); keep #489/#491 and per-field timestamps.
- Required tests: keep the tier lists consistent with any Check changes.

`testing.md`:
- GitHub fake: name the operations (`getIssue`, `updateIssue`, `probeIssues`) with scripted answers per (integration, operation), including `not_modified` and the issue-specific kinds.
- `FakeClock` plus an injected scheduler drive the rate-limit timer, the stale threshold and the 60 s fresh skip.
- Worker tests: the `(engine)` specs run with the issues retry config (`maxRetries`, cooldown 1 ms) and verify exhaustion through the job's own attempt counter; a rate-limited job finishes without `_fail`.
- Coverage table: update the Sync row (rate-limit waiting set, fallback, staleness).
- Open questions: close the operation-names question.

`issues.md` (index): the `issues/testing.md` row drops "(operation names owned by #488 remain open)"; the `issues/sync.md` row shows decided.

## Files to Change
- `docs/agents/specs/issues/edge-cases.md` — statuses, rule links, E18 and E24 wording, open questions.
- `docs/agents/specs/issues/testing.md` — fake operations, clock and scheduler, engine specs, coverage, open questions.
- `docs/agents/specs/issues.md` — index row statuses.
