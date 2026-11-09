# Deduplicate the Required tests sections

Apply the issue's owner table. Each test lives once, in its owner file. Other files either drop their copy or replace it with a one-line link (`[owner.md](owner.md#required-tests)`) where the cross-reference helps the reader. A file keeps only the part of an item that its own rule defines.

| Test | Owner | What the other files keep |
|---|---|---|
| Add candidate walk | `integrations.md` | `api.md`: only the HTTP answers |
| Budget tracker | `integrations.md` | `sync.md`: a refused acquire marks the source `rate_limited` |
| `401` / mint `404`/`403` → `invalid` with compare-and-set | `integrations.md` | `sync.md`: the handle fallback after `401` |
| Non-usable never called | `integrations.md` | `sync.md`: the source stores `invalid_credentials`/`error` and keeps its rows |
| Handle `404` | `integrations.md` (→ `not_found`) | `sync.md`: the source effect; `model.md`: the row status Unknown |
| Fixed host, no redirect, own page URLs | `integrations.md` | `sync.md`: a redirect makes the source `error`; `security.md`: link |
| Zombie run / `run_id` / lock release | `sync.md` | `security.md`: link |
| Integration-deletion cleanup | `model.md` | `integrations.md`: event emission and listener failure; `sync.md`: end-of-sync safety net; `security.md`: link |
| Handle normalisation, validation, edit path, default user, admins | `model.md` | `security.md`: link |
| Concurrent claim / one sync / cooldown | `sync.md` | `api.md`: the `202` / `429` answers; `security.md`: link |
| Per-route `401`, `OriginGuard`, `X-Skip-Cache`, cache class, foreign = missing `404`, admins | `security.md` (route access matrix) | `api.md`: link |
| No credential in any response or log | `security.md` (canary sweep) | `api.md`, `integrations.md`: link |

While doing this, look for any other duplicate between sections and resolve it by the same rule: the owner is the file whose rule the test verifies.

## Files to Change

- `docs/agents/specs/repos/api.md` — "Required tests": drop or link the duplicated items.
- `docs/agents/specs/repos/sync.md` — "Required tests": keep only the sync-side effects.
- `docs/agents/specs/repos/integrations.md` — "Required tests": the owner items stay; the deletion item is narrowed.
- `docs/agents/specs/repos/model.md` — "Required tests": the handle-`404` item is narrowed to the row status.
- `docs/agents/specs/repos/security.md` — "Required tests": keep the matrix, the canary sweep, the boundary tooling and the handle-path abuse rules not owned by `model.md`; link the rest.
