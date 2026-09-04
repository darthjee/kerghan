# Product Definitions

**Status: partial.** The high-level flow (login, repo selection, on-demand issue fetching) is
decided — see [Flow](flow.md). Entity definitions, an ownership chain, and role definitions
still don't exist, because the core tracked-repo/label-rule data model is still open. This file
is the canonical place for the `product-owner`, `data-access`, and `security` agents to check
"is this decided yet?".

## What's already decided (see [Flow](flow.md) for the full context)

- **What Kerghan is**: a GitHub issue monitoring/dashboard app. Users log into Kerghan itself
  (lightweight account/session, not GitHub OAuth) and register the repos/orgs they care about.
- **Core value**: label-based attention triage — surfacing which tracked repos "need attention"
  based on issues carrying certain labels, across every repo a user tracks, in one place.
- **Multi-tenant**: each user account registers its own set of repos/orgs to monitor — unlike a
  single shared dataset.
- **What the backend persists**: only account/login state and each user's repo selection.
  Issue data itself is **not** persisted by default — see "Issue fetching model" below.
- **Issue fetching model**: on demand, live, fetched **client-side** by the frontend directly
  against GitHub's public REST API — not by the backend. This is what lets the backend stay idle
  between visits and moves GitHub's unauthenticated rate limit (60 requests/hour per source IP)
  from being shared across every Kerghan user (if the backend fetched) to being scoped to each
  user's own browser IP instead. Refresh is manual (user-triggered), not automatic/polled.
- **GitHub access**: unauthenticated, public-repo data only for now. No OAuth app, no PAT
  storage, no GitHub App installation. A per-user GitHub token for private-repo access is a
  planned future addition, not yet built.
- **Frontend surface**: a dashboard/analytics view (issue volume, age, label breakdowns, "needs
  attention" lists), not just CRUD forms — API design should be aggregation-friendly.
- **No file uploads, no GitHub webhooks.** An admin-role-gated UI is allowed (see #40's admin
  role/guard and #41's admin user-lookup/recovery-link tool) — this is not general admin-panel
  scaffolding, just narrowly-scoped tooling gated behind `@AdminOnly()`.
- **Env vars for the framework**: simple env-driven config, read once at boot (no hidden env
  reads inside classes) — `KERGHAN_SECRET_KEY` (session/cookie signing, backing the login
  described in [Flow](flow.md)), `KERGHAN_ALLOWED_ORIGINS` (CORS allowlist), `NODE_ENV`/`DEBUG`.

## Deferred (future, not current scope)

- **Opt-in issue persistence**: persisting fetched issues to MySQL, only when a user opts in
  (e.g. for history/trend views). Not built.
- **Historical/trend collection**: volume-over-time or similar views, which depend on the
  opt-in persistence above. Not built.
- **Per-user GitHub token**: unlocks private-repo access. Not built.

## What's still open

- **The data model**: how a user's tracked repos/orgs and label rules are modeled and scoped per
  account. This is the single biggest open question blocking real entity/ownership/access-rule
  documentation here.
- Everything downstream of the data model: entity definitions, ownership chain, role
  definitions, editing rules, the real API endpoint shape.

## Once the data model is decided

Rewrite this file following the shape `majora-2/docs/agents/product.md` uses as a reference:
entity definitions, ownership chain, role definitions, and editing rules. At that point, also:

- Update `docs/agents/index.md`/`summary.md` to describe this file's real content instead of
  pointing at a stub.
- Write `docs/agents/access-control.md` (or fold access rules into this file, matching whichever
  shape the real model calls for).
- Update `.claude/agents/product-owner.md` and `.claude/agents/data-access.md` to reference the
  real rules instead of "flag by default."
