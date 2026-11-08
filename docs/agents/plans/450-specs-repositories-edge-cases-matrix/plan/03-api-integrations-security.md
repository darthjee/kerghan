# api.md, integrations.md and security.md rules

**`api.md`:**

- **`#repo-ref`:** the `fullName` tie-break (latest `last_seen_at`, then highest `id`); remove
  "Further rename handling is #450's…".
- **`#listing`:** `sources[]` lists every current source holding a row for the repo, as of that
  source's last applied page, failed and `pending` ones included. The shape is unchanged.
- **`#sync-state`:**
  - `sources[].status` gains `not_found`;
  - a stored `invalid_credentials` for an integration that is now usable reports `pending`.
- **`#add`:**
  - step 6 becomes a conditional `UPDATE … AND added_at IS NULL`; zero rows ⇒ re-read (added ⇒
    `200` with the current row; missing ⇒ `404`);
  - step 5 gains `409 REPOSITORY_SOURCE_UNUSABLE` when there are zero candidates before any
    call.
- **`#errors`:** add the `409 REPOSITORY_SOURCE_UNUSABLE` row (message `The integration that
  sees this repository needs attention.`; new code in `core/error-codes.ts`).
- **Required tests:** the issue's `api.md` entries (tie-break, `githubId` after a rename,
  `sources[]` with a failed source, `pending` for a fixed integration, double Add, `409` vs
  `404`).

**`integrations.md`:**

- **`#usable-integrations`:**
  - record the accepted "rows kept until fixed or deleted" (replacing "#450 may revisit");
  - `integration_unusable` reasons become `'status' | 'type_disabled' | 'missing'`.
- **`#error-mapping`:** the handle `not_found` maps to the source status `not_found`.
- **`#invalid-on-401` and `#github-app-installation-tokens`:** every status change from a repo
  call is a compare-and-set,
  `WHERE id = :id AND user_id = :userId AND secret_iv = :ivUsed`. This covers a `401` ⇒
  `invalid`, a mint `404`/`403` ⇒ `invalid`, and a decrypt failure ⇒ `undecryptable`.
- **`#access-link-on-add` and `#add-re-check-candidates`:**
  - the end-of-sync link fill (a link to `sync.md#link-fill`);
  - zero candidates ⇒ `409`.
- **`#deletion-hook`:** "User deletion stays #450's" becomes a link to `model.md`'s user
  deletion.
- **Required tests:** the `missing` reason; the compare-and-set (a `401` from before a Replace
  leaves the integration `active`).

**`security.md`:**

- **`#credentials-stay-in-the-backend`:** the `secret_iv` compare value never leaves the
  Integrations module (no Repositories code, response or log).
- **Required tests:** that line.

## Files to Change

- `docs/agents/specs/repos/api.md` — repo ref, listing, sync state, Add, errors, tests.
- `docs/agents/specs/repos/integrations.md` — usable integrations, `missing`, error mapping,
  compare-and-set, link fill, `409`, user deletion link, tests.
- `docs/agents/specs/repos/security.md` — the `secret_iv` line and its test.
