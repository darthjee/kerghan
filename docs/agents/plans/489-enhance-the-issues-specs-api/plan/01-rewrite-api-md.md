# Rewrite api.md

Replace the "principles only" body of `docs/agents/specs/issues/api.md` with the decisions of the issue's Solution section, keeping the header line linking to the spec index. Suggested structure:

1. **Every route**: the route conventions (POST-only, `.json`, verb suffixes with `show.json`, uuid path ids with `ParseUUIDPipe`, issue routes nested under the project, `JwtGuard`, `OriginGuard`, cache class `user-scoped` with `X-Skip-Cache` and `Cache-Control: no-store`, no Navi, whitelist `ValidationPipe`, standard errors, no admin access, thin controllers).
2. **Routes table**: all 17 routes (projects listing, create, from-repository, show, edit, repository, delete, refresh; issues listing, create, import, show, edit, delete, attach, unlink, refresh, retry-sync).
3. **Exposed identifiers**: the uuid `id`, the repo ref, the forbidden fields, the repository summary, `number` and `url` for a link.
4. **Projects**: the project object, listing, creation order of checks, edit, repository, delete with `unsentIssueCount`, and `error.meta`.
5. **Issues**: the issue object (no `body` in listing rows), listing (state filter, title search, newest created first), create/edit, delete only while unlinked.
6. **GitHub link**: import, attach, unlink; order of checks; the E57 to E60 mapping; the attach confirmation flow with `ISSUE_ATTACH_CONFIRMATION_REQUIRED` and `datetime(3)`; unlink refusals.
7. **Sync exposure**: the link object table, the precedence of `states`, no "syncing" state; T2/T3/T4 routes, `alreadyFresh`, the retry no-op, refusals, retry refused while Unavailable.
8. **Errors**: the full catalogue (17 new codes, the three `404` messages, `422 GITHUB_ISSUE_IS_PULL_REQUEST`), helpers in `issues/issues-http-errors.ts`.
9. **Input validation**: the field table, strict types, code-point lengths, body not trimmed, output timestamps.
10. **Open questions**: close the six #489 items. Anything left goes to its owner: wording, placement and polling cadence (#491); rendering of GitHub content and request rate limits or quotas on creation routes (#490).
11. **Required tests**: rewrite to match every rule (default tier e2e with fakes, `(db)` for races):
    - the route access matrix: every route answers `401` without a session, runs `OriginGuard`, sends `X-Skip-Cache` on success and handler errors, declares `user-scoped`, answers no `GET`; another user's or a deleted project and an issue of another project answer `404`; malformed uuids answer `400`;
    - no response contains an internal id, `user_id`, an integration field or credential material; `error.meta` carries only uuids, counts, field names, timestamps or reasons;
    - each project, issue, link and trigger outcome and code of the catalogue, including the creation and repository-change races `(db)`, the attach stale confirmation within the same second (`datetime(3)`), delete refused while linked and the attach/delete race `(db)`;
    - listing defaults, bounds, sort, filters, literal search and totals; rows without `body`;
    - the link object: `states` precedence, `linked` alone, `reason`, `rateLimitedUntil`, `stale` never for `gone`; reads never enqueue;
    - T2 `202`/`200 alreadyFresh`, T3 counts, T4 reset and no-op, the refusals, retry refused while Unavailable keeps the reason;
    - validation: strict types, code-point lengths with a 4-byte character, trimming rules, `null` handling, `number` bounds.

## Files to Change

- `docs/agents/specs/issues/api.md` — full rewrite as above.
