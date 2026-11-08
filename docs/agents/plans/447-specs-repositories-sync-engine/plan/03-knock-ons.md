# api.md, ui.md, security.md, integrations.md knock-ons

- `api.md`:
  - Sync state: `startedAt` is `last_started_at` while `syncing`, `null` when idle;
    `refreshAvailableAt` = `last_started_at` + cooldown; a sync past its lease reads `idle`.
  - Polling contract: interval 2 s; replace "the value is #447's" and the "#447 must guarantee"
    note with a link to `sync.md#execution`.
  - Refresh: replace "the duration is #447's" (5 min) and settle "a `rate_limited` source is
    skipped until its `resetAt`".
  - Add: losing a race with pruning answers `404 NOT_FOUND`; the low-budget `503` comes from the
    shared unauthenticated tracker.
- `ui.md`: remove the #447 polling marker; the interval is 2 s (frontend constant); its README
  row goes.
- `security.md`: fixed base URL — pagination builds its own page URLs and never requests a URL
  taken from a response; update the matching required test.
- `integrations.md`: notes for #448 — the GitHub client hosts the unauthenticated budget tracker;
  the handle source asks for the next usable integration after a `401`; the deletion hook also
  removes page and status rows and triggers pruning. Keep #448's markers.

## Files to Change
- `docs/agents/specs/repos/api.md`
- `docs/agents/specs/repos/ui.md`
- `docs/agents/specs/repos/security.md`
- `docs/agents/specs/repos/integrations.md`
