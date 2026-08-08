# Product Definitions

**Status: stub.** This document doesn't have entity definitions, an ownership chain, or role
definitions yet, because the core data model question is still open. This file exists so
`docs/agents/index.md`/`summary.md` have somewhere real to point, and so the `product-owner`,
`data-access`, and `security` agents have one canonical place to check for "is this decided
yet?" rather than re-deriving it from kerghan.md each time.

## What's already decided (see kerghan.md §1 for the full context)

- **What Kerghan is**: a GitHub issue monitoring/dashboard app. Users register repos/orgs they
  care about; Kerghan polls/aggregates their issues into MySQL.
- **Core value**: label-based attention triage — surfacing which tracked repos "need attention"
  based on issues carrying certain labels, across every repo a user tracks, in one place.
- **Multi-tenant**: each user account registers its own set of repos/orgs to monitor and
  (presumably) its own label rules/filters — unlike a single shared dataset.
- **GitHub access**: unauthenticated, public-repo data only (kerghan.md §1/§21). No OAuth app,
  no PAT storage, no GitHub App installation. Constraint to design around: GitHub's
  unauthenticated rate limit is 60 requests/hour per source IP, shared across every Kerghan user
  polling from this one server.
- **Polling model**: on-demand fetch (when a user views a tracked repo), cached in MySQL between
  views — no scheduled/background polling.
- **Frontend surface**: a dashboard/analytics view (issue volume, age, label breakdowns, "needs
  attention" lists), not just CRUD forms — API design should be aggregation-friendly.
- **No admin UI, no file uploads, no GitHub webhooks.**

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
