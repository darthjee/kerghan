# Issue: Specs: repositories feature definition

## Description

Part of Epic #444 (repositories: list a user's GitHub repos and add them to Kerghan). This is the Epic's **first** sub-issue: it writes the feature specs that every other sub-issue builds against, following the feature-spec lifecycle in `docs/agents/specs.md`.

Write `docs/agents/specs/repos/` from the decisions recorded in #444 (Scope, Integrations & ownership, Data model, Where the fetch happens, Fetch flow, UI, Performance & security considerations), and add the feature to "Active specs" in `docs/agents/specs.md`.

## Problem

The tracked-repo data model is still listed under "What's still open" in `docs/agents/product.md`, and #444's decisions live only in the Epic's body. The spec-enhancement sub-issues (#446–#451), the implementation sub-issues and the final fold (#452) need one shared, versioned definition to build against — otherwise each would make its own decisions about the data model, API, security and UI.

## Expected Behavior

- `docs/agents/specs/repos/` exists with the seven files listed under "Layout", each non-README file ending with "Required tests".
- Every decision already taken in #444 is recorded; every point owned by #446–#451 is marked with an open marker linking its issue.
- `README.md` has the "Open markers" table, the sub-issue table (#445–#452) and the one-at-a-time order.
- `docs/agents/specs.md` "Active specs" lists the feature, linking `docs/agents/specs/repos/README.md` and #444.
- The product-owner, security and data-access agents reviewed the specs before the PR was opened.
- No code changes, and no change to permanent docs.

## Solution

### Layout

Each file except `README.md` ends with a "Required tests" section.

```
docs/agents/specs/repos/
├── README.md          overview, scope, product decision (#444), decisions summary, index
├── model.md           repositories table (every repo seen per user, added_at, integration_id,
│                      last_seen_at), sources table, per-user sync state + ETags, github_handle
│                      on auth_users, logical FKs, cleanup on integration/user deletion,
│                      unavailable/unknown rules
├── sync.md            sources and GitHub endpoints per integration type, staleness TTL,
│                      asynchronous sync, partial failures, rate-limit headers, ETags, page caps
├── api.md             paginated listing (filters, search), sync state, refresh, add (re-checked
│                      with GitHub); errors, JwtGuard, X-Skip-Cache
├── integrations.md    what the Integrations module exports (authenticated GitHub requests —
│                      credentials never leave it), 401 → invalid, deletion hook
├── security.md        "credentials stay in the backend" rule, user scoping (404, no admin
│                      access), add verification, private metadata lifecycle, handle
│                      validation, fixed GitHub base URL, CSRF, no secrets in logs/errors
└── ui.md              top-level Repositories navbar link, table, toolbar (filter/search/refresh/
                       last synced), sync UX, source error banners, empty state, handle field
```

### Key decisions to carry over (from #444)

- Every GitHub call happens in the **backend**; the frontend never receives a credential.
- One merged listing: all of the user's integrations plus the public repos of an optional GitHub handle stored on the account; deduplicated by GitHub repository id.
- One `repositories` table per user for every repo seen in a sync, with nullable `added_at`; a sources table; logical foreign keys only.
- Sync on demand when stale + forced Refresh (cooldown, one sync per user at a time), asynchronous; the listing is a paginated API served from the database.
- Partial failures return per-source status; a `401` marks the integration `invalid`; added repos whose only sources failed are **unknown**, not unavailable.
- Add is re-checked with GitHub; the oldest non-`invalid` integration that sees the repo becomes its access link.
- Out of scope: removing repos, adding by `owner/name`, issues/label rules, org-wide tracking, scheduled sync, webhooks.

Values and exact contracts left open here (TTL, cooldown, caps, route shapes, sync execution model, …) are marked as such and settled by the spec-enhancement sub-issues of #444.

### Scope

Follows the precedent of the earlier "feature definition" sub-issues (#425, #403, #367), which only touched `docs/agents/specs.md` and the new spec folder.

#### In scope

- Create `docs/agents/specs/repos/` with the seven files listed in "Layout" (each non-README file ending with "Required tests").
- Record **every decision already taken in #444** (merged listing, GitHub handle, single per-user `repositories` table with `added_at`, sources table, logical FKs, async stale/Refresh sync, paginated API, partial failures, Add re-check, credentials-stay-in-the-backend rule, UI).
- Mark each point that a spec-enhancement sub-issue settles, linking the owning issue (#446 API contract, #447 sync engine, #448 Integrations GitHub client, #449 GitHub handle and default user, #450 edge cases, #451 testing strategy), so nothing is decided twice.
- Add the "Active specs" entry to `docs/agents/specs.md`, linking `docs/agents/specs/repos/README.md` and #444.

#### Out of scope

- Any code, migration or frontend change.
- Any permanent doc change (`product.md`, `flow.md`, `modules/`, `backend/routes/`, `architecture/security.md`, …) — that is #452.
- Settling what #446–#451 own: exact routes and shapes, sync values and execution model, per-type authentication, handle validation and the default-user block narrowing, the edge-case matrix, the testing strategy.
- Changes to `.claude/agents/` definitions.

### Depth

**Skeleton named, details open.** For anything owned by #446–#451, this sub-issue names the parts so every spec file reads as a coherent whole, and leaves the details open:

- **Named here:** the list of routes (method + purpose: listing, sync state, refresh, add), the tables and their columns (`repositories`, the sources table, per-user sync state, `auth_users.github_handle`), the sync states (`idle` / `syncing`), the per-source statuses (ok, error, invalid credentials, rate limited, page cap reached), the row statuses (Added, Not added, Unavailable, Unknown), and the module boundaries (what the Integrations module exports, at the level of "authenticated GitHub requests for a (user, integration)").
- **Left open, each with a link to its owning issue:** request/response shapes, paths, pagination and filter parameters, status and error codes (#446); TTL, cooldown, page cap, rate-limit threshold, timeouts, ETag storage, pruning rule, in-process vs queue execution (#447); per-type authentication, GitHub endpoints per type, the deletion hook's mechanism (#448); handle validation details and the default-user block narrowing (#449); the edge-case matrix (#450); the testing strategy (#451).
- Every file's "Required tests" covers what is decided here; tests for open points are added by the issue that settles them.

### Open-point markers

Reuse the convention of the autocomplete specs (#425):

- Each open point is marked in its file as a callout: `> **Open — settled by #NNN:** …`.
- `README.md` has an **"Open markers"** section: a table of every marker (file + anchor, open decision, settling issue), stating that each sub-issue removes its own markers and rows, and that #452 checks none remain.
- `README.md` also has a **sub-issue table** (issue, title, spec files it touches) covering #445–#452, with a note that implementation sub-issues are added to #444 later and listed here when created.

### Sequencing

The spec-enhancement sub-issues all edit `docs/agents/specs/repos/` (the shared README tables, `model.md`, `security.md`), so they go **one at a time**, as in the autocomplete precedent: #445 → #446 → #447 → #448 → #449 → #450 → #451; implementation sub-issues follow; #452 is last. `README.md` states this order.

### Reviewers

Before the PR is opened, the written specs are reviewed (read-only) by:

- **product-owner** — the new repository entity settles part of `product.md`'s open data model; the GitHub handle; first use of integration credentials.
- **security** — credentials staying in the backend and inside the Integrations module, Add re-check, user scoping, handle validation, CSRF, logging.
- **data-access** — new endpoints and response fields, `404` for other users' repos, no admin access.

Their findings are either fixed in the specs or recorded as an open marker owned by the right spec-enhancement sub-issue.
