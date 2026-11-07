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
  or **Unknown** (added, but its only sources failed in the latest sync).
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
- Changing an added repo's access link after Add.
- An environment variable to set the GitHub handle.
- The permanent docs (`product.md`, `flow.md`, `modules/`, `backend/routes/`,
  `architecture/security.md`, `cache-warmer.md`, …): folded in by #452.

## Decisions summary

- **Backend-only GitHub calls** — authenticated and unauthenticated; the frontend never calls
  GitHub for this feature and never receives a credential ([security.md](security.md#credentials-stay-in-the-backend)).
- **Merged listing** of every integration plus the GitHub handle's public repos, deduplicated by
  GitHub repository id; each row shows its sources ([sync.md](sync.md#sources)).
- **GitHub handle**: a nullable `github_handle` on `auth_users`, owned by Auth, editable by the
  default user too ([model.md](model.md#github-handle)).
- **One `repositories` table per user** for every repo seen, with a nullable `added_at`; a
  sources table; per-user sync state ([model.md](model.md)).
- **Logical foreign keys only** to `auth_users` and `integrations`; cleanup on integration
  deletion ([model.md](model.md#logical-foreign-keys)).
- **Asynchronous sync** when stale or on Refresh; one sync per user at a time; Refresh cooldown
  ([sync.md](sync.md#trigger)).
- **Paginated, filterable listing** served from the database, never straight from GitHub
  ([api.md](api.md#routes)).
- **Partial failures** reported per source; `401` marks the integration `invalid`; added repos
  whose only sources failed are **unknown**, not unavailable ([sync.md](sync.md#partial-failures),
  [model.md](model.md#row-statuses)).
- **Add re-checked with GitHub**; the oldest usable integration that sees the repo becomes its
  access link ([api.md](api.md#add), [integrations.md](integrations.md#access-link-on-add)).
- **Credentials stay inside the Integrations module**, which exports authenticated GitHub
  requests ([integrations.md](integrations.md)).
- **UI**: a top-level **Repositories** navbar link, a table with a toolbar, and a GitHub handle
  field on the Account page ([ui.md](ui.md)).

## Sub-issues

| Issue | Title | Spec files it touches |
|---|---|---|
| #445 | Specs: repositories feature definition | all (creates them) |
| #446 | Specs: repositories — exact API contract | [api.md](api.md), [security.md](security.md), [ui.md](ui.md) |
| #447 | Specs: repositories — sync engine | [sync.md](sync.md), [model.md](model.md), [ui.md](ui.md) |
| #448 | Specs: repositories — Integrations GitHub client | [integrations.md](integrations.md), [sync.md](sync.md), [model.md](model.md), [security.md](security.md) |
| #449 | Specs: repositories — GitHub handle and default user | [model.md](model.md), [security.md](security.md), [ui.md](ui.md) |
| #450 | Specs: repositories — edge cases matrix | every file |
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
| [model.md](model.md#tables) | Exact table names, column types, indexes, and the sync-state and ETag storage shape | #447 |
| [model.md](model.md#private-metadata-lifecycle) | Pruning rule details for not-added repos | #447 |
| [model.md](model.md#logical-foreign-keys) | Integration-deletion hook mechanism (call vs event) | #448 |
| [model.md](model.md#logical-foreign-keys) | User-deletion cleanup path | #450 |
| [model.md](model.md#github-handle) | `github_handle` column type, validation and normalisation | #449 |
| [sync.md](sync.md#execution) | In-process vs queue execution, restart behaviour, per-user lock mechanism | #447 |
| [sync.md](sync.md#values) | TTL, Refresh cooldown, page cap, rate-limit threshold, timeouts, parallelism | #447 |
| [sync.md](sync.md#sources) | GitHub endpoint and parameters per integration type | #448 |
| [sync.md](sync.md#edge-cases) | Sync edge cases (renames, transfers, visibility flips, deletion mid-sync, handle changes, concurrent syncs) | #450 |
| [api.md](api.md#contract) | Paths, request/response shapes, pagination format, filter and search parameters, status and error codes, polling contract | #446 |
| [integrations.md](integrations.md#exported-service) | Exported interface, per-type authentication (incl. GitHub App installation tokens), error mapping | #448 |
| [integrations.md](integrations.md#access-link-on-add) | Which integration statuses count as usable (`expired`, `undecryptable`) | #448 |
| [integrations.md](integrations.md#deletion-hook) | Deletion-hook mechanism (call vs event) | #448 |
| [security.md](security.md#github-handle) | Handle validation details and the default-user block narrowing | #449 |
| [security.md](security.md#credentials-stay-in-the-backend) | Guarantees of the Integrations exported interface | #448 |
| [security.md](security.md#errors-and-logging) | Exact error codes and messages | #446 |
| [ui.md](ui.md#sync-ux) | Refresh-cooldown (`429`) message and sync-state polling interval | #446, #447 |
| [ui.md](ui.md#github-handle-field) | Handle field validation messages | #449 |
| [ui.md](ui.md#edge-cases) | UI edge cases | #450 |
| Every "Required tests" section | The testing strategy: GitHub mocking, sync-engine tests, frontend specs | #451 |

## Index

| File | Defines |
|---|---|
| [model.md](model.md) | `repositories`, sources and sync-state tables, `auth_users.github_handle`, row statuses, logical FKs, private metadata lifecycle, ownership |
| [sync.md](sync.md) | Sources, trigger (stale / Refresh), asynchronous execution, per-source processing, partial failures, rate limits, ETags |
| [api.md](api.md) | Routes (listing, sync state, refresh, add), guards, cache class, access rules |
| [integrations.md](integrations.md) | What the Integrations module exports, `401 → invalid`, access-link choice, deletion hook |
| [security.md](security.md) | Credentials stay in the backend, user scoping, Add verification, handle validation, fixed base URL, CSRF, logging, abuse limits |
| [ui.md](ui.md) | Navbar link, table, toolbar, sync UX, source error banners, empty state, GitHub handle field |

## Required tests

Every rule is tested from the "Required tests" section of the file that defines it.
