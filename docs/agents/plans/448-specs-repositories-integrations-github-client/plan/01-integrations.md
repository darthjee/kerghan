# integrations.md: service, client, endpoints, tokens, usable, errors, hook, tracker

Rewrite `docs/agents/specs/repos/integrations.md` so it carries every #448 decision and no
"Open — settled by #448" note remains. Copy from the issue's Solution section.

- **Exported service:** name it `IntegrationsGithubService`; the four operations with their
  signatures; integration identity by internal id with `WHERE id = ? AND user_id = ?`; the
  `RepoPageResult` / `RepoResult` / `GithubRepo` types; entry validation; own page URLs and
  `Link` read only for `rel="next"`. Fold in the existing "Notes for #448" bullets (tracker,
  handle credential, `If-None-Match`/headers/timeout) as settled facts.
- **Single client:** new subsection — every call goes through the Integrations client;
  `integrationId: null` sends no `Authorization`.
- **Endpoints and parameters:** the table (per type, handle, re-check), the `sort=created` and
  explicit `affiliation`/`visibility` reasons, handle `type=owner`, field mapping, body caps.
- **GitHub App installation tokens:** cache key and lifetime, single-flight, `metadata: read`,
  eviction, the 401 rule (cached → re-mint and retry once; fresh → `unavailable`, status
  unchanged; only mint `404`/`403` invalidate), the mint-failure table.
- **Invalid on 401:** keep the rule; add that it applies to `pat` / `oauth_app` through each
  type's existing test mapping, and point at the GitHub App exception.
- **Usable integrations / Access link on Add:** replace the open note with the usable rule
  (reported `active` + type enabled), the status table, and the `integration_unusable` reasons.
- **Error mapping:** the table and the header-only rate-limit rule; the Add candidate walk
  (order, next/stop rules, 3-call cap).
- **Shared helpers:** `githubUnavailable` / `githubRateLimited` move to
  `core/github-http-errors.ts` (done by the implementation issue).
- **Deletion hook:** replace the open note with the awaited `integration.deleted` event, its
  payload, the listener's user-scoped transaction, the best-effort rule, the token-cache
  eviction, and a link to the sync safety net.
- **Unauthenticated budget tracker:** home (`GithubUnauthenticatedBudget`, not exported),
  `tryAcquire` / `record`, reservations, the two thresholds; link to `sync.md#rate-limits`.
- **Required tests:** add the issue's 14 Required tests that belong to the Integrations side
  (all except those placed in `sync.md`/`security.md` by steps 02–03); drop "Tests for the open
  points above are added by the issue that settles them" if no open point remains.

## Files to Change
- `docs/agents/specs/repos/integrations.md` — all of the above.
