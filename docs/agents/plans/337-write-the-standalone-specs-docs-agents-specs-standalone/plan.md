# Plan: Write the standalone specs (docs/agents/specs/standalone/)

Issue: [337-write-the-standalone-specs-docs-agents-specs-standalone.md](../../issues/337-write-the-standalone-specs-docs-agents-specs-standalone.md)

## Overview

Write the feature specs for epic #336 under `docs/agents/specs/standalone/`, following the specs
hub conventions (`docs/agents/specs.md`): a `README.md` index plus seven files split by concern,
each ending with a "Required tests" section. Register the feature under the hub's "Active specs".
Docs only: no code, Dockerfile or CI change.

## Context

- Source material: the bodies of epic #336 (scope, alternatives, image naming, Render, variables,
  client, config, edge cases, ordering) and issue #337 (folder layout, hub integration, resolved
  verifications, scope boundaries). Read both with `gh issue view <n>` before writing.
- Hub rules: one `README.md` per feature with overview, purpose, scope, the product decision and an
  index; files split by concern; a "Required tests" section at the end of each file; specs describe
  decisions, not code (naming existing code only to point at a convention).
- Specs decide contracts (names, paths, env contract, observable behavior, CI order, verified facts,
  what tests must prove). Implementation details (script structure, Dockerfile internals, CI
  multi-arch mechanics, test tooling, message wording) are left to each sub-issue's plan.
- Edge cases are spread into the file each belongs to; there is no `edge-cases.md`.
- Root instruction files and agents link only to the hub, never to `docs/agents/specs/standalone/`.

## Steps

- [01 — Write README.md](plan/01-readme.md)
- [02 — Write images.md](plan/02-images.md)
- [03 — Write render.md](plan/03-render.md)
- [04 — Write stack.md](plan/04-stack.md)
- [05 — Write variables.md](plan/05-variables.md)
- [06 — Write client.md](plan/06-client.md)
- [07 — Write config.md](plan/07-config.md)
- [08 — Write installer.md](plan/08-installer.md)
- [09 — Register the feature in the specs hub](plan/09-hub-entry.md)

## Notes

- No CI job covers `docs/`; verify by reading: every file linked from the README, every #336
  decision present, no `TODO`s, no links to `docs/agents/specs/standalone/` from `AGENTS.md`,
  `CLAUDE.md` or `.claude/agents/`.
- Verified facts to record verbatim: `darthjee/vault:0.1.0` is multi-arch; `darthjee/tent`
  publishes `1.0.3` (amd64) and `1.0.3-arm64` (arm64) as separate tags; `mysql:9.3.0` is multi-arch;
  Render allows switching a Git-backed service to a prebuilt image in place
  (https://render.com/changelog/change-your-services-backing-repo-or-image-in-the-render-dashboard);
  `OriginGuard` passes `Sec-Fetch-Site: same-origin` writes, and older browsers fall back to
  `Origin` vs `Host`, which Tent rewrites.
- Keep each file readable on its own: a sub-issue should only need the README plus its own file(s).
