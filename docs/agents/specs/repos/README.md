# Repositories

Temporary feature specs for **listing a logged-in user's GitHub repositories and adding them to
Kerghan**. Product decision: #444. Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

Kerghan's core value is per-user repo tracking ([product.md](../../product.md),
[flow.md](../../flow.md) steps 2–3), but no repository entity exists yet. This feature adds it:

- A **Repositories** page lists the user's GitHub repositories. The listing **merges** every
  source the user has: each of their [integrations](../../modules/integrations.md), plus the
  public repositories of an optional **GitHub handle** stored on their account. Duplicates are
  merged by GitHub repository id.
- Each row is **Added**, **Not added**, **Unavailable** (added, but no source returns it any more)
  or **Unknown** (added, but its only sources failed or have not been synced yet).
- Not-added rows have an **Add** button that adds the repo to Kerghan for that user.
- Every GitHub call happens in the **backend**. The frontend only talks to Kerghan's API.
- Everything is **user-scoped**: a user sees and manages only their own repositories.

It is the foundation for later per-repo features (issues, label rules, "needs attention"), which
are out of scope here.

## Scope

In scope (from #444):

- The listing page, each repo marked added / not added / unavailable / unknown
  ([ui.md](ui.md)).
- The **Add** action, re-checked with GitHub ([api.md](api.md), [security.md](security.md)).
- Persistence: one per-user `repositories` table holding every repo seen, a sources table and
  per-user sync state ([model.md](model.md)). This settles the "tracked repos" part of the open
  data model in `product.md`.
- Private and organization repositories through the user's integrations: the first feature that
  uses integration credentials ([integrations.md](integrations.md)).
- An optional GitHub handle on the account ([model.md](model.md#github-handle),
  [ui.md](ui.md#github-handle-field)).
- On-demand, asynchronous sync from GitHub ([sync.md](sync.md)).
- User-scoped access, no admin access ([security.md](security.md#user-scoping)).

Out of scope (from #444):

- Removing a repo from Kerghan once added.
- Adding a repo by `owner/name` that is not in the user's own listing.
- Listing or fetching issues, label rules, "needs attention" triage.
- Org-wide tracking (one entry following every repo of an org).
- Scheduled or background sync, polling GitHub. Syncs run only on demand.
- Webhooks (already excluded by `product.md`).
- Changing an added repo's existing access link after Add. **Amended by #450:** #444 also said
  that a private repo whose linked integration was deleted becomes Unavailable; #450 has the next
  sync fill an **empty or dangling** link with a usable integration that returned the repo in that
  sync ([sync.md](sync.md#link-fill)), so it reads Unavailable only until then. An existing link
  is never changed. Reason: otherwise a re-created integration, or a public repo added through the
  handle that turns private, leaves the repo Unavailable forever.
- An environment variable to set the GitHub handle.
- The permanent docs (`product.md`, `flow.md`, `modules/`, `backend/routes/`,
  `architecture/security.md`, `cache-warmer.md`, …): folded in by #452.

## Product changes folded by #452

What this feature changes in the permanent product docs, as a checklist for the fold:

- **`product.md`, what the backend persists:** from "each user's repo selection" to a per-user
  snapshot of **every GitHub repo seen** in a sync, including private metadata of repos the user
  never added ([model.md](model.md#private-metadata-lifecycle) bounds its lifetime, except the
  rows of non-usable integrations, kept until the integration is fixed or deleted: accepted by
  #450, [integrations.md](integrations.md#usable-integrations)). Also: an added private repo whose
  linked integration was deleted reads Unavailable only until the next sync fills its link
  ([sync.md](sync.md#link-fill)), amending #444.
- **`product.md`, "What's still open":** the tracked-repos part of the data model is settled;
  label rules, org-wide tracking and the rest stay open.
- **`product.md`, "Deferred → Using integration credentials":** partly lifted, for repo listing
  only. Issue fetching stays unauthenticated and in the browser, so the `CLAUDE.md` boundary
  stays true and only needs wording.
- **`flow.md` step 2:** discovery merges the handle's public repos and the integrations' repos,
  all fetched by the backend.
- **`flow.md` "Open questions"** (repo selection refreshed periodically or on demand): answered —
  on demand when stale, plus Refresh.
- **`modules/integrations.md`:** "The module exports nothing yet" and the "Not built yet" note on
  `401 → invalid` change: the module exports `IntegrationsGithubService` and emits the awaited
  `integration.deleted` event; and the "Credential stops working" edge case: nothing polls, but a
  repo call answered `401` (or a mint `404`/`403` for a GitHub App) now sets the integration
  `invalid`; outside those, the status changes only on test or replace
  ([integrations.md](integrations.md)).
- **`modules/integrations/github-app.md`:** installation tokens are cached in memory for repo
  calls (until `expires_at` − 5 min, minted with `metadata: read`) instead of minted per use;
  test connection still mints fresh
  ([integrations.md](integrations.md#github-app-installation-tokens)).
- **`architecture/security.md`:** the "credentials stay in the backend" rule becomes its own
  section ([security.md](security.md#credentials-stay-in-the-backend)).
- **`backend/routes/repositories.md`:** created from [api.md](api.md).
- **`architecture/backend.md#error-responses`:** the optional `error.retryAfterSeconds` body
  field ([api.md](api.md#errors)).
- **`modules/auth/default-user.md`:** "What is blocked" and "Rule: per field, by presence" gain
  `github_handle` as an editable, unmanaged field; the "every editable field is managed today"
  rationale (and "in practice every edit reaching the default user is rejected") is replaced by
  [model.md](model.md#default-user)'s; boot sync never touches the handle.
- **`modules/auth.md`:** the new exported `AccountHandleService`; the `github_handle` column; the
  admin routes table stays without the handle.
- **`backend/routes/auth.md`:** `PATCH /auth/account.json` (the `githubHandle` field, the
  `currentPassword`-only-with-managed-fields rule, the handle-only path outside the abuse guard,
  the `{ username, email, githubHandle }` response, the new `assertAnyFieldPresent` message) and
  the new `POST /auth/account/mine.json`; the default-user `409` table's `account.json` row.
- **`environment-variables.md`:** `KERGHAN_REPOSITORIES_ADD_MAX_PER_WINDOW` and
  `KERGHAN_REPOSITORIES_ADD_WINDOW_MS` ([api.md](api.md#add-rate-limit));
  `KERGHAN_REPOSITORIES_SYNC_TTL_MS`, `KERGHAN_REPOSITORIES_SYNC_COOLDOWN_MS` and
  `KERGHAN_REPOSITORIES_SYNC_PAGE_CAP` ([sync.md](sync.md#values)).
- **`modules/auth.md` and the Repositories module doc:** the `user.deleted` contract: Auth emits
  the awaited `UserDeletedEvent { userId }` after the user delete commits, once a deletion path
  exists, and Repositories' listener deletes the user's rows in its five tables
  ([model.md](model.md#user-deletion)). The deletion path must retry the event or run an orphan
  sweep, since a failed listener only logs.
- **`backend/routes/repositories.md` and `core/error-codes.ts`:** the `409
  REPOSITORY_SOURCE_UNUSABLE` Add answer ([api.md](api.md#errors)).
- **`backend/routes/repositories.md` and the Repositories module doc:** the `not_found` source
  status of the handle source ([sync.md](sync.md#handle-credential)).
- **`modules/integrations.md`:** every status change caused by a repo call (`401`, mint
  `404`/`403`, decrypt failure) is a compare-and-set on `secret_iv`
  ([integrations.md](integrations.md#status-compare-and-set)).
- **The Repositories module doc, "Edge cases":** built from the
  [edge-case matrix](edge-cases.md).

## Decisions summary

- **Backend-only GitHub calls** — authenticated and unauthenticated; the frontend never calls
  GitHub for this feature and never receives a credential ([security.md](security.md#credentials-stay-in-the-backend)).
- **Merged listing** of every integration plus the GitHub handle's public repos, deduplicated by
  GitHub repository id; each row shows its sources ([sync.md](sync.md#sources)).
- **GitHub handle**: a nullable `github_handle varchar(39)` on `auth_users`, owned by Auth, no
  uniqueness; normalised (trim, one leading `@`, lowercase, empty ⇒ `null`) and validated against
  GitHub's username format. Set by a handle-only `PATCH /auth/account.json` that needs no
  current password and skips the abuse guard; read by a new `POST /auth/account/mine.json`;
  exported to Repositories as `AccountHandleService#getGithubHandle`. The default-user `409`
  narrows to the managed fields, so the default user can set it; admins neither see nor edit it
  ([model.md](model.md#github-handle)).
- **Handle changes reconciled lazily**: every Repositories route and sync run compares the
  current handle with `repositories_sync_states.handle` and drops (and prunes) the old handle's
  rows on a mismatch; a running sync's handle writes are guarded by the handle it started with
  ([model.md](model.md#handle-changes)).
- **One `repositories` table per user** for every repo seen, with a nullable `added_at`; plus
  `repositories_sources`, `repositories_source_pages`, `repositories_sync_states` and
  `repositories_source_statuses`, each source keyed by `source_key` ([model.md](model.md#tables)).
- **Logical foreign keys only** to `auth_users` and `integrations`; cleanup on integration
  deletion ([model.md](model.md#logical-foreign-keys)).
- **Asynchronous, in-process sync** (a detached promise, no queue) when stale (TTL 1 h) or on
  Refresh; one sync per user at a time through an atomic conditional `UPDATE`; a 5 min Refresh
  cooldown ([sync.md](sync.md#trigger), [sync.md](sync.md#execution)).
- **Lease recovery:** a heartbeat per page, a 2 min lease, `run_id`-guarded writes and a 5 min
  hard deadline, so a sync stuck in `syncing` always returns to `idle`
  ([sync.md](sync.md#restart-recovery)).
- **Page-number pagination with stored ETags** in a page table; one transaction per page, so a
  failing source keeps the pages already applied ([sync.md](sync.md#write-path)).
- **Orphan pruning:** a not-added repo with no source row is deleted at the end of each sync and
  after an integration deletion or a handle change; a failed source blocks it by construction
  ([model.md](model.md#private-metadata-lifecycle)).
- **Every route is `POST`** (reads included, as user-scoped reads in the repo), so the listing's
  stale-sync trigger needs no `GET` exception ([api.md](api.md#every-route)).
- **Paginated, filterable listing** served by `POST /repositories/mine.json` from the database,
  never straight from GitHub ([api.md](api.md#listing)).
- **Repo ref** `{ githubId }` or `{ fullName }` in the body; `githubId` is the canonical key and
  the internal `id` is never exposed ([api.md](api.md#repository-identity)).
- **Partial failures** reported per source; `401` marks the integration `invalid`; added repos
  whose only sources failed are **unknown**, not unavailable ([sync.md](sync.md#partial-failures),
  [model.md](model.md#row-statuses)).
- **Add re-checked with GitHub**, idempotent (already added answers `200`), rate limited per
  user; the oldest usable integration that sees the repo becomes its access link
  ([api.md](api.md#add), [integrations.md](integrations.md#access-link-on-add)).
- **Credentials stay inside the Integrations module**, which exports `IntegrationsGithubService`:
  fixed, `GET`-only operations returning typed results; no credential, minted token or GitHub
  body leaves it ([integrations.md](integrations.md#exported-service)).
- **One GitHub client** in the Integrations module for authenticated and unauthenticated calls;
  Repositories holds no HTTP code ([integrations.md](integrations.md#unauthenticated-calls)).
- **Endpoints:** `GET /user/repos` (`pat`, `oauth_app`), `GET /installation/repositories`
  (`github_app`), `GET /users/{handle}/repos?type=owner`, `GET /repositories/{id}` (Add);
  listings sorted `created` ascending so earlier pages keep their ETag
  ([integrations.md](integrations.md#endpoints-and-parameters)).
- **Installation tokens cached in memory** until `expires_at` − 5 min, single-flight, minted
  with `metadata: read`; only a mint `404`/`403` invalidates a `github_app` integration
  ([integrations.md](integrations.md#github-app-installation-tokens)).
- **Usable integration** = reported `active` and type enabled; non-usable sources are not called
  and keep their rows ([integrations.md](integrations.md#usable-integrations)).
- **One error-mapping table** (rate limits from headers only, redirects classified, never
  followed) and an **Add candidate walk** capped at 3 GitHub calls
  ([integrations.md](integrations.md#error-mapping),
  [integrations.md](integrations.md#add-re-check-candidates)).
- **`502`/`503` helpers move to `core/github-http-errors.ts`**
  ([integrations.md](integrations.md#shared-502--503-helpers)).
- **Integration deletion** through an awaited `integration.deleted` event, with an end-of-sync
  safety net ([integrations.md](integrations.md#deletion-hook), [sync.md](sync.md#write-path)).
- **Unauthenticated budget tracker** internal to the Integrations client, with in-flight
  reservations and two thresholds: sync ≤ 10, Add ≤ 0
  ([integrations.md](integrations.md#unauthenticated-budget-tracker)).
- **UI**: a top-level **Repositories** navbar link, a table with a toolbar, and a GitHub handle
  field on the Account page ([ui.md](ui.md)).

**Edge cases (#450)**, every case listed in the [edge-case matrix](edge-cases.md):

- **`fullName` tie-break:** the latest `last_seen_at`, then the highest `id`
  ([api.md](api.md#repo-ref)).
- **`pending` counts as not ok** for row statuses ([model.md](model.md#row-statuses)).
- **A row's `sources[]`** lists every current source holding a row, failed and `pending` ones
  included; the UI mutes not-ok badges ([api.md](api.md#listing), [ui.md](ui.md#table)).
- **A missing integration** answers `integration_unusable` with reason `missing`; its source
  stops without a status ([integrations.md](integrations.md#usable-integrations),
  [sync.md](sync.md#sources)).
- **A fixed integration reads `pending`:** a stored `invalid_credentials` for an integration now
  usable is reported as `pending` ([api.md](api.md#sync-state)).
- **End-of-sync link fill (amends #444's "deleted link ⇒ Unavailable" outcome):** an added
  private repo's empty or dangling link gets the oldest usable integration whose source is `ok`
  or `page_cap_reached` and returns it ([sync.md](sync.md#link-fill)). An existing link is never
  changed.
- **Handle source status `not_found`** on a `404`, with no fallback and a retry every sync
  ([sync.md](sync.md#handle-credential)).
- **User deletion** through an awaited `user.deleted` event; the listener deletes the user's rows
  in all five tables ([model.md](model.md#user-deletion)).
- **A sync run never creates the sync-state row** ([sync.md](sync.md#write-path),
  [model.md](model.md#handle-changes)).
- **`page_cap_reached` counts as `ok`**, and rows past the cap are trimmed
  ([model.md](model.md#row-statuses), [sync.md](sync.md#write-path)).
- **The last stored page is requested without `If-None-Match`**, so a new repo past a full last
  page is fetched ([sync.md](sync.md#conditional-requests)).
- **Add's write is conditional** on `added_at IS NULL`, so a double Add writes once
  ([api.md](api.md#add)).
- **Status compare-and-set on `secret_iv`** for every status change caused by a repo call
  ([integrations.md](integrations.md#status-compare-and-set)).
- **`409 REPOSITORY_SOURCE_UNUSABLE`** when Add has no candidate before any GitHub call
  ([api.md](api.md#add), [integrations.md](integrations.md#add-re-check-candidates)).
- **Ten UI edge-case rules** ([ui.md](ui.md#edge-cases)).
- **Accepted:** rows of non-usable integrations are kept until the integration is fixed or deleted
  ([integrations.md](integrations.md#usable-integrations)).

## Sub-issues

| Issue | Title | Spec files it touches |
|---|---|---|
| #445 | Specs: repositories feature definition | all (creates them) |
| #446 | Specs: repositories — exact API contract | [api.md](api.md), [security.md](security.md), [ui.md](ui.md), [sync.md](sync.md), [integrations.md](integrations.md), [model.md](model.md) |
| #447 | Specs: repositories — sync engine | [sync.md](sync.md), [model.md](model.md), [ui.md](ui.md), [api.md](api.md), [security.md](security.md), [integrations.md](integrations.md) |
| #448 | Specs: repositories — Integrations GitHub client | [integrations.md](integrations.md), [sync.md](sync.md), [model.md](model.md), [security.md](security.md), [api.md](api.md) |
| #449 | Specs: repositories — GitHub handle and default user | [model.md](model.md), [security.md](security.md), [ui.md](ui.md), [sync.md](sync.md), [api.md](api.md) |
| #450 | Specs: repositories — edge cases matrix | [edge-cases.md](edge-cases.md) (creates it), and every file |
| #451 | Specs: repositories — testing strategy | every "Required tests" section |
| #452 | Specs: fold the repositories specs into the permanent docs and remove them | all |

Implementation sub-issues are added to #444 later, from the enhanced specs, and listed here when
they are created.

**Order:** #445 → #446 → #447 → #448 → #449 → #450 → #451 → implementation sub-issues → #452.
The spec-enhancement sub-issues edit the same folder (the tables in this README, `model.md`,
`security.md`), so they go one at a time.

## Open markers

Decisions this folder leaves to later sub-issues. Each is marked in its file as
`> **Open — settled by #NNN:** …`. Each sub-issue removes its own markers and rows from this
table, and #452 checks that none remain.

| File | Open decision | Settled by |
|------|---------------|------------|
| Every "Required tests" section | The testing strategy: GitHub mocking, sync-engine tests, frontend specs | #451 |

## Index

| File | Defines |
|---|---|
| [model.md](model.md) | The five tables (columns, types, indexes, `source_key`), `auth_users.github_handle` (column, normalisation, validation, edit and read routes, default user, admins, Auth export, handle-change reconciliation), row statuses, logical FKs and user deletion, private metadata lifecycle and pruning rule, ownership |
| [sync.md](sync.md) | Sources and the handle's credential, trigger (stale / Refresh), in-process execution, per-user lock, lease recovery, page-number pagination, write path, partial failures, pruning, rate limits and the unauthenticated budget tracker, ETags, values |
| [api.md](api.md) | Routes, request/response contract, repo ref, sync state and polling, errors, access rules |
| [integrations.md](integrations.md) | `IntegrationsGithubService` (operations, typed results), the single GitHub client, endpoints per source, installation-token cache, `401 → invalid`, usable integrations, error mapping, access-link choice and Add candidate walk, `502`/`503` helpers in `core/`, `integration.deleted` hook, unauthenticated budget tracker |
| [security.md](security.md) | Credentials stay in the backend, user scoping, Add verification, handle validation, fixed base URL, CSRF, logging, abuse limits |
| [ui.md](ui.md) | Navbar link, table, toolbar, sync UX, source error banners, empty states, GitHub handle field, UI edge cases |
| [edge-cases.md](edge-cases.md) | Edge-case matrix: every case, its outcome and the rule behind it |

## Required tests

Every rule is tested from the "Required tests" section of the file that defines it.
