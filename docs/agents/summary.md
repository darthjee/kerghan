# Documentation Summary

A 2-4 line abstract of each doc under `docs/agents/`, so an agent can decide whether to open the
full file before loading it. For a bare link-only table of contents instead, see
[index.md](index.md).

## Architecture

- **[Folder Structure](folder-structure.md)** — Top-level directory layout: what each top-level
  folder (`backend/`, `frontend/`, `proxy/`, `dockerfiles/`, `docs/`, etc.) is for.
- **[Architecture](architecture.md)** — Hub page splitting the architecture by concern (proxy,
  frontend, backend) to keep agent contexts small. Read the linked area page relevant to your
  task instead of loading everything.

## Conventions

- **[Contributing](contributing.md)** — Commit guidelines (atomic, no unrelated changes,
  separate refactors) and PR standards (descriptive summary, description files when needed).
- **[Product Definitions](product.md)** — Currently a stub: the tracked-repo/label-rule data
  model is still an open product decision (see kerghan.md §1/§21). Read it to confirm what's
  decided vs. still open before planning any issue that introduces new entities.

## External tooling

- **[Cache Warmer](cache-warmer.md)** — How Kerghan uses Navi to warm the Tent proxy cache after
  each production release; used by the `cache` agent. Given Kerghan's multi-tenant model, most
  endpoints are excluded from warming by default.

## Plans & Issues

- **[Plans](plans/)** — Implementation plans for ongoing or upcoming features, one directory per
  issue (`<issue_id>_<topic>/`).
- **[Issues](issues/)** — Detailed specs for open issues, one file per issue
  (`<issue_id>_<issue_name>.md`).
