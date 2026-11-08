# Rewrite api.md as the exact contract

Rewrite `docs/agents/specs/repos/api.md` from the issue's Solution, in the
`docs/agents/backend/routes/` style (a conventions list, a routes table, one subsection per
route with request/response examples and error codes):

- **Conventions / Every route:** all four routes are `POST` with `.json`, `JwtGuard`,
  `OriginGuard`, cache class `user-scoped` (`X-Skip-Cache`, `Cache-Control: no-store`), never
  warmed by Navi; controllers thin. Replace the `GET` wording everywhere.
- **Routes table:** `POST /repositories/mine.json`, `POST /repositories/sync/state.json`,
  `POST /repositories/sync.json`, `POST /repositories/add.json`.
- **Listing:** request body table (`page`, `perPage` ≤ 100 default 50, `filter`
  `all|added|not_added|unavailable`, `search` ≤ 100 chars), response example
  (`repositories[]`, `pagination`, `sync`), row fields, `accessIntegration` `null` cases, fixed
  sort, past-the-end page. Stale-sync trigger stated as part of this `POST`; remove the
  `api.md#listing` open marker (no `GET` exception exists any more).
- **Repository identity:** internal `id` never exposed; `githubId` canonical (cross-instance
  rationale); `fullName` in every response; the **repo ref** (`{ githubId }` xor `{ fullName }`,
  body only, `fullName` case-insensitive against the caller's own rows, why not in the path).
- **Sync state:** object example and field table (`state`, `startedAt`, `lastSyncedAt`,
  `refreshAvailableAt`, `sources[]` with `status` incl. `pending`, `syncedAt`, `resetAt`); the
  polling contract (frontend constant interval from #447; stop on `idle` / unmount / `401`;
  reload; transient errors keep polling; never starts a sync; #447 must guarantee `syncing`
  returns to `idle`).
- **Refresh:** the four-case table, order of checks, cooldown from any sync start.
- **Add:** the six-step table (validation → rate limit → own-rows lookup → already added `200`
  → GitHub re-check → write `200`), the `502`/`503` reuse, rate-limit values
  (`KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW`=30, `KERGHAN_REPOSITORIES_ADD_WINDOW_MS`=60000,
  `getNumberConfig`), the `401` → #448 note. Keep the existing owner-lookup and
  unauthenticated-budget rules.
- **Errors:** the full error table (status, code, message, where), including the two new codes
  `REPOSITORY_REFRESH_COOLDOWN` and `REPOSITORY_ADD_RATE_LIMITED` with `Retry-After` +
  `retryAfterSeconds`, and the single `Repository not found` message.
- **Access:** keep the existing section (user scoping, no admin access, exposed identifiers),
  adding that the internal repository `id` is never exposed.
- Remove the `## Contract` open marker section.
- **Required tests:** keep the existing items (adjusting `GET` wording) and add the issue's
  "Contract tests" backend items.

## Files to Change
- `docs/agents/specs/repos/api.md` — full rewrite as the exact contract.
