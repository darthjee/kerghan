# sync.md

Create `docs/agents/specs/repos/sync.md` — how the backend syncs GitHub into the model.

Decided:

- **Sources:** each of the user's integrations, plus the public repos of `github_handle`. The handle's public repos are fetched through a valid integration when the user has one; unauthenticated only otherwise.
- **Trigger:** opening the listing starts a sync when the last sync is older than a TTL; **Refresh** forces one. No scheduled job.
- **Asynchronous:** the triggering request does not wait; the listing returns stored rows plus sync state; the frontend polls the state and reloads when the sync ends.
- **One sync per user at a time**; forced Refresh has a cooldown (`429` + `Retry-After`, details in api.md).
- **Per source:** follow every GitHub page up to a cap; upsert by `github_id`, refresh `owner`/`name`/`private`, rewrite source rows, set `last_seen_at`; store the per-source status.
- **Partial failures:** a failing source does not fail the sync; its rows are kept as they were; `401` sets the integration `invalid` (through the Integrations module).
- **Rate limits:** read `X-RateLimit-Remaining` / `X-RateLimit-Reset`; stop the unauthenticated source early when low and mark it rate limited.
- **Conditional requests:** store each page's `ETag`, send `If-None-Match`; a `304` reuses stored data.
- Fixed base URL `https://api.github.com`; timeouts and a bound on parallel GitHub calls.

Open markers: in-process vs queue and restart behaviour, lock mechanism, TTL / cooldown / page cap / rate-limit threshold / timeout / parallelism values, ETag storage, pruning rule (#447); GitHub endpoint and parameters per integration type (#448); edge cases (#450).

End with **Required tests** for the decided behaviour (stale triggers, forced refresh, async return, one sync per user, partial failure keeps rows, `401 → invalid`, `304` reuse, rate-limit stop, unauthenticated path only without a valid integration).

## Files to Change
- `docs/agents/specs/repos/sync.md` — new.
