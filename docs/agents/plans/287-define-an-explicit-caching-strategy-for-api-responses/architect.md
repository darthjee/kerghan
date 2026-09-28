# Architect Plan: Define an explicit caching strategy for API responses

Main plan: [plan.md](plan.md)

## Shared contracts

Documents the contracts in [plan.md](plan.md#shared-contracts) verbatim: the cache classes,
`@CachePolicy()`, the header table, the unchanged proxy rule, and the strategy doc path
`docs/agents/architecture/caching.md`.

## Steps

- [01 — Write the caching strategy document](architect/01-strategy-doc.md)
- [02 — Point existing docs and agent definitions at the strategy](architect/02-update-references.md)

## Notes
- Run this after (or alongside) the backend work, so the names in the docs match the code
  exactly.
