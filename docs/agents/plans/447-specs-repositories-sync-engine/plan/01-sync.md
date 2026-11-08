# sync.md: execution, values, pagination, write path, pruning, handle

Rewrite the affected sections of `docs/agents/specs/repos/sync.md` from the issue's Solution:

- **Trigger:** keep the rules; add that a stale listing claims with the TTL clause, a Refresh
  without it, both bound by the cooldown (anchored on `last_started_at`).
- **Execution:** replace the #447 marker with the in-process detached promise, the claim SQL,
  the insert-ignore row creation, the lease/heartbeat rule (a dead lease reads `idle` and may be
  taken over), `run_id` guards, the hard deadline, no reset at boot, and "an interrupted source
  keeps its previous rows and status". Keep the `api.md#polling-contract` guarantee explicit.
- **Per source:** page-number pagination (`Link` only for `rel="next"`), the per-page
  transaction (heartbeat guard → upsert `ON DUPLICATE KEY` → rewrite the page's source rows and
  `last_seen_at` → store `etag`/`has_next`), end-of-source and end-of-sync transactions,
  `last_synced_at` set even when every source failed.
- **Partial failures:** applied pages stay; the rest keep their old rows.
- **Conditional requests:** the page table, `304` reuse, invalidation rules, and the corrected
  rate-limit wording (a `304` is free only when authenticated).
- **Sources / Rate limits:** the handle through the oldest usable integration, next one on
  `401`, unauthenticated last, no fallback on rate limit/timeout/`5xx`; skip `rate_limited`
  sources until `resetAt`; the process-wide unauthenticated budget tracker shared with Add
  (code location: #448).
- **Pruning:** a new section (or a link to `model.md`) with the orphan rule and when it runs.
- **Network:** pagination never requests a response-supplied URL.
- **Values:** replace the marker with the values table (TTL 1 h, cooldown 5 min, page cap 10 ×
  100, threshold ≤ 10, timeout 10 s, 3 sources in parallel, lease 2 min, deadline 5 min,
  polling 2 s) and the three env vars.
- **Required tests:** add the issue's Expected Behavior test list; replace the "follows `Link`"
  test wording.

## Files to Change
- `docs/agents/specs/repos/sync.md` — the sections above.
