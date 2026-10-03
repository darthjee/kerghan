# Documentation Summary

A 2-4 line abstract of each doc under `docs/agents/`, so an agent can decide whether to open the
full file before loading it. For a bare link-only table of contents instead, see
[index.md](index.md).

## Architecture

- **[Folder Structure](folder-structure.md)** — Top-level directory layout: what each top-level
  folder (`backend/`, `frontend/`, `proxy/`, `dockerfiles/`, `docs/`, etc.) is for.
- **[Flow](flow.md)** — Target end-to-end flow (not yet implemented): login, repo selection
  persisted by the backend, issues fetched live client-side against GitHub, manual refresh.
- **[Architecture](architecture.md)** — Hub page splitting the architecture by concern (proxy,
  frontend, backend, modular pattern, infra) to keep agent contexts small. Read the linked area
  page relevant to your task instead of loading everything.
- **[Modules](modules/)** — Per-backend-module documentation (routes, entities, events), one
  file per module (`modules/auth.md`, `modules/mail.md` and `modules/integrations.md` today).
  Read the module's page before extending or consuming it.
  - **[Auth](modules/auth.md)** — Kerghan's always-on login module: `/auth/*.json` routes, the
    `auth_` tables, the JWT/refresh-token flow, and the `user.registered` and
    `password-recovery.requested` events.
  - **[Mail](modules/mail.md)** — Always-on, general-purpose transactional email sender. No HTTP
    surface; consumed via the exported `MailService`. `KERGHAN_EMAIL_*` config read once at boot;
    disabled by default (log-and-skip). Templated sends via `sendEmailTemplate`, backed by
    filesystem templates under `mail/templates/` read once at boot. First consumer: #39.
  - **[Integrations](modules/integrations.md)** — Always-on module for labelled GitHub
    credentials owned by one user each (`pat`, `oauth_app`, `github_app`, one page per type
    under `modules/integrations/`): data model, owner-only access, AES-256-GCM encryption with
    `KERGHAN_INTEGRATIONS_KEY`, rate limits, the type contract and the Integrations page. Not yet
    used for issue fetching.
- **[Routes](backend/routes.md)** — Per-endpoint backend route reference, one file per domain
  under `backend/routes/` (`auth.md` and `integrations.md` today), complementing the
  entity/event-focused `modules/` pages.

## Conventions

- **[Contributing](contributing.md)** — Commit guidelines (atomic, no unrelated changes,
  separate refactors) and PR standards (descriptive summary, description files when needed).
- **[Product Definitions](product.md)** — What's decided (login/session, persisted repo
  selection, integrations as the only GitHub credential storage, issues fetched live
  client-side, no issue persistence by default) vs. still open (the tracked-repo/label-rule data
  model) and deferred (opt-in issue persistence, history/trends, using integration credentials
  for private repos). Read it before planning any issue that introduces new entities.
- **[Issue Enhancement](issue-enhancement.md)** — Checklist of concerns (`/enhance-issue` uses
  this) for fleshing out a vague issue idea before it reaches the `Created` stage.
- **[Environment Variables](environment-variables.md)** — Every env var Kerghan's production
  deployment needs: backend runtime (Render), the cache warmer, and CircleCI deploy-pipeline
  secrets — with each one marked as actually consumed by code or still reserved. Update it
  whenever a "reserved" var gets wired up or a new one is added.

## API caching

- **[API Caching](architecture/caching.md)** — Single source of truth for API caching: Tent
  shared-caches every 2xx `*.json` response unless it carries `X-Skip-Cache`; every route
  declares a `public`/`user-scoped`/`never` class with `@CachePolicy()` (enforced by a spec),
  which drives `X-Skip-Cache` and `Cache-Control`; 10s stale-while-revalidate; writes clear the
  collection/entity entries; only `public` GET endpoints may be warmed by Navi.

## External tooling

- **[External Tooling](external.md)** — Hub linking the full usage guides for the non-Kerghan
  tools the project depends on: Tent (proxy), Navi (cache warmer), and navi-hey-client (Navi's
  CLI/library). Read the linked guide before making changes involving that tool.
- **[Cache Warmer](cache-warmer.md)** — How Kerghan uses Navi to warm the Tent proxy cache after
  each production release; used by the `cache` agent. Given Kerghan's multi-tenant model, most
  endpoints are excluded from warming by default. Also documents the per-user cache Tent is
  developing, expected to eventually replace `X-Skip-Cache` for user-scoped reads.

## Specs, Plans & Issues

- **[Specs](specs.md)** — Permanent hub for temporary feature specs under `specs/<feature>/`:
  purpose, lifecycle (first sub-issue writes them, last one folds them into the permanent docs
  and deletes them), conventions, and the list of active specs (none today).
- **[Plans](plans/)** — Implementation plans for ongoing or upcoming features, one directory per
  issue (`<issue_id>_<topic>/`).
- **[Issues](issues/)** — Detailed specs for open issues, one file per issue
  (`<issue_id>_<issue_name>.md`).
