# Plan: Docs: docs/agents/environment-variables.md is 428 lines — split into hub + focused pages

Issue: [525-docs-docs-agents-environment-variables-md-is-428-lines-split-into-hub-focused-pages.md](../../issues/525-docs-docs-agents-environment-variables-md-is-428-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization. `docs/agents/environment-variables.md` (428 lines) becomes a slim hub, and its sections move unchanged into five pages under `docs/agents/environment-variables/`. Inbound links that target a moved section are retargeted, and relative links inside moved content are fixed. This is cross-cutting docs work, owned by the architect; no specialist agent's code scope is touched.

## Context
The file exceeds the 300-line cap from AGENTS.md. Current sections (line ranges): intro 1–11; "1. Backend application runtime" 12–93; "Default user" 94–134; "Setting `KERGHAN_INTEGRATIONS_KEY`" 135–152; "GitHub OAuth App" 153–181; "GitHub App" 182–241; "Rotating `KERGHAN_SECRET_KEY`" 242–275; "Rotating `KERGHAN_INTEGRATIONS_KEY`" 276–335; "2. Proxy" 336–343; "3. Cache warmer" 344–354; "4. CircleCI" 355–380; "5. Standalone" 381–423; "Keeping this doc honest" 424–428. The target pages (all well under 300 lines): `backend.md` ≈ 82, `backend-setup.md` ≈ 148, `key-rotation.md` ≈ 94, `proxy-navi-circleci.md` ≈ 45, `standalone.md` ≈ 43.

Inbound anchors that move: `#5-standalone-darthjeekerghan-standalone` (README.md, `docs/agents/standalone.md`, `standalone/inner-stack.md`, `standalone/config-files.md`), `#1-backend-application-runtime` and `#default-user-values-and-boot-validation` (`modules/auth/user-approval.md`, `modules/auth/default-user.md`), `#rotating-kerghan_integrations_key` (`modules/integrations/security.md`). Plain-path links (no anchor) to the hub stay valid, but topic-specific ones should point at the page that now holds the topic.

## Steps

- [01 — Create the pages and slim the hub](plan/01-create-pages-and-slim-hub.md)
- [02 — Retarget inbound links](plan/02-retarget-inbound-links.md)
- [03 — Verify](plan/03-verify.md)

## Notes
- Move text verbatim (use `sed -n` ranges, not retyping) so meaning cannot drift; only link paths/anchors and the section numbering references change.
- Section headings keep their numbers only if the references to them stay accurate (e.g. "section 5" mentions in moved text must be rewritten as links to `standalone.md`); keep that to the minimum wording change needed.
- Page boundaries follow the issue's proposal; line counts above confirm the cap holds.
