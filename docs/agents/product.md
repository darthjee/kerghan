# Product Definitions

**Status: partial.** The high-level flow (login, repo selection, on-demand issue fetching) is
decided — see [Flow](flow.md), and so are [integrations](#integrations). Entity definitions,
an ownership chain, and role definitions for the core tracked-repo/label-rule data model still
don't exist, because that model is still open. This file
is the canonical place for the `product-owner`, `data-access`, and `security` agents to check
"is this decided yet?".

## What's already decided (see [Flow](flow.md) for the full context)

- **What Kerghan is**: a GitHub issue monitoring/dashboard app. Users log into Kerghan itself
  (username/password, a JWT `access_token` cookie, and a rotating refresh token kept in an
  httpOnly cookie — not GitHub OAuth) via the frontend's login modal, either directly or by having an already-logged-in device
  approve the login through the device-authorization flow (see `docs/agents/modules/auth.md`),
  and register the repos/orgs they care about.
- **Core value**: label-based attention triage — surfacing which tracked repos "need attention"
  based on issues carrying certain labels, across every repo a user tracks, in one place.
- **Multi-tenant**: each user account registers its own set of repos/orgs to monitor — unlike a
  single shared dataset.
- **What the backend persists**: account/login state, each user's repo selection, and each
  user's [integrations](#integrations) (labelled, encrypted GitHub credentials).
  Issue data itself is **not** persisted by default — see "Issue fetching model" below.
- **Issue fetching model**: on demand, live, fetched **client-side** by the frontend directly
  against GitHub's public REST API — not by the backend. This is what lets the backend stay idle
  between visits and moves GitHub's unauthenticated rate limit (60 requests/hour per source IP)
  from being shared across every Kerghan user (if the backend fetched) to being scoped to each
  user's own browser IP instead. Refresh is manual (user-triggered), not automatic/polled.
- **GitHub access**: issue data is still fetched unauthenticated and client-side, public-repo
  data only. Users can store GitHub credentials (Personal Access Token, OAuth App
  authorization, GitHub App installation) as [integrations](#integrations), which are the
  **only** allowed GitHub credential storage; nothing uses them for issue fetching yet (see
  "Deferred").
- **Frontend surface**: a dashboard/analytics view (issue volume, age, label breakdowns, "needs
  attention" lists), not just CRUD forms — API design should be aggregation-friendly.
- **No file uploads, no GitHub webhooks.** An admin-role-gated UI is allowed (see #40's admin
  role/guard and #41's admin user-lookup/recovery-link tool) — this is not general admin-panel
  scaffolding, just narrowly-scoped tooling gated behind `@AdminOnly()`.
- **Env vars for the framework**: simple env-driven config, read once at boot (no hidden env
  reads inside classes) — `KERGHAN_SECRET_KEY` (session/cookie signing, backing the login
  described in [Flow](flow.md)), `KERGHAN_ALLOWED_ORIGINS` (CORS allowlist, falling back to `FRONTEND_BASE_URL`'s origin —
  format and production wildcard rule in [Environment Variables](environment-variables.md)),
  `NODE_ENV`/`DEBUG`.

## Integrations

Decided by #295; the full definition is in the
[Integrations module](modules/integrations.md).

- **Entity**: an `Integration` is a labelled GitHub credential slot. It is owned by exactly one
  user, and a user can have many (up to a configurable cap). Each has a `provider` (`github`), a
  `type` (`pat`, `oauth_app` or `github_app`), a user-defined label unique per user, and a
  status (`active`, `invalid`, `expired`, `undecryptable`).
- **Access rules**: only the owner can see or manage an integration. Another user's integration
  answers 404, like a missing one. Admins get no access to anyone's integrations.
- **Secrets**: encrypted at rest (AES-256-GCM, with a dedicated `KERGHAN_INTEGRATIONS_KEY`),
  never returned by the API, never logged; the owner only sees a masked hint.
- **Credential storage boundary**: integrations are the only allowed way to store GitHub
  credentials. Any other way still needs its own product decision.

## Deferred (future, not current scope)

- **Opt-in issue persistence**: persisting fetched issues to MySQL, only when a user opts in
  (e.g. for history/trend views). Not built.
- **Historical/trend collection**: volume-over-time or similar views, which depend on the
  opt-in persistence above. Not built.
- **Using integration credentials**: credentials can be stored as
  [integrations](modules/integrations.md), but nothing uses them for issue fetching yet (the
  backend only calls GitHub with them to test a connection or list GitHub App installations).
  Backend proxying of GitHub calls with a user's integration, and reading private repositories
  with it, are not built.

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
