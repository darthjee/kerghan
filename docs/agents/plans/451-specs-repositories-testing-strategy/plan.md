# Plan: Specs: repositories — testing strategy

Issue: [451-specs-repositories-testing-strategy.md](../../issues/451-specs-repositories-testing-strategy.md)

## Overview

Docs-only change under `docs/agents/specs/repos/`.

- Write the new `testing.md`, which holds the Repositories testing strategy.
- Record the design rules it relies on in their owning spec files:
  - `Clock`, no-`NOW()` and `SyncLauncher` in `sync.md`;
  - the boundary tooling in `security.md`.
- Run the consistency pass over every "Required tests" section:
  - each test gets one owner file, and the others link to it;
  - each section opens with a link to `testing.md`;
  - add exception tier tags and the new items.
- Update README.md: Index, Open markers, Decisions summary, #452 fold checklist.

## Context

#451 is the last spec-enhancement sub-issue of Epic #444. The issue's Solution section holds every decision, settled in the enhance and discuss dialogues:

- **Test tiers:** unit, e2e with fakes, a narrow real-MySQL `*.db-spec.ts` tier, static, frontend.
- **GitHub mocking:**
  - Integrations is mocked at the `fetch` level;
  - Repositories uses a typed `FakeIntegrationsGithubService`;
  - both share typed builders, a fake-fidelity contract spec and a no-network guard.
- **Detached sync and time:** an injected `SyncLauncher` (a `CapturingLauncher` in tests) and an injected `Clock` (`FakeClock`); no `NOW()` in SQL.
- **Races:** true-parallel races on the DB tier plus scripted interleavings at fake GitHub answers; no production test hooks.
- **Access and leaks:** a route access matrix with a completeness check, a credential canary sweep, and a two-user baseline in every harness.
- **Module boundaries:** an ESLint override plus a static boundary spec.
- **Frontend:** Jasmine specs in three layers (client / controller / render), shared builders, and a static "no `api.github.com`" spec.
- **Cache:** the cache-policy coverage spec asserts `UserScoped`; `navi/` is unchanged.
- **Consistency:** one owner per test, following the owner table in the issue.

No code, CI, ESLint, package or compose change: the implementation sub-issues do those.

## Steps

Each step file is self-contained. Execute them in this order:

- [01 — Design rules in their owning files](plan/01-design-rules.md)
- [02 — Write testing.md](plan/02-testing-md.md)
- [03 — Deduplicate the Required tests sections](plan/03-dedupe-required-tests.md)
- [04 — Opening links, tier tags and new items](plan/04-links-tags-new-items.md)
- [05 — README.md](plan/05-readme.md)
- [06 — Consistency review](plan/06-consistency-review.md)

## CI Checks

No CI job covers `docs/agents/specs/`. Check the Markdown links manually: every relative link and every `#anchor` must resolve. There is nothing to run through docker-compose.

## Notes

- Specs describe decisions, not code (`docs/agents/specs.md` conventions). Name types such as `SyncLauncher`, `Clock` and `FakeIntegrationsGithubService` as contracts, not implementations.
- Keep the anchors other files already link to (`sync.md#values`, `api.md#required-tests`, …). New links into "Required tests" sections use `#required-tests`.
- The README must not claim the CI job or the ESLint override already exist. They are added by the first implementation sub-issue that needs them.
