# Docs: docs/agents/backend/routes/auth.md is 486 lines — split into hub + focused pages

## Context

`docs/agents/backend/routes/auth.md` is 486 lines long, above the repo's 300-line cap (AGENTS.md), and mixes several independent topics. Agents load the file whole, so any question pulls the entire document into context, and editing it raises the chance of merge conflicts.

## What needs to be done

Turn `docs/agents/backend/routes/auth.md` into a hub and move its sections into focused pages under `docs/agents/backend/routes/auth/`, following the pattern of #509, #510 and #511.

- Hub: a short 1-2 paragraph summary, the intro, an endpoint index and Source files; ends with an index linking every page under `auth/`, each with a one-line "when to read it" description.
- Proposed pages (the plan may adjust boundaries):
  - `login.md` — `login`, `register`, `refresh`, `logoff` and `status` endpoints
  - `authorization-requests.md` — the `/auth/authorization-requests/*` endpoints
  - `sessions-and-account.md` — sessions endpoints (`mine`, revoke, revoke-others) and account endpoints
  - `shared.md` — default user `409` (`DEFAULT_USER_MANAGED`), user status, shared behavior, session cookies
- Pure reorganization: content moves, it is not rewritten, dropped or changed in meaning.
- Update every inbound link (AGENTS.md, `.claude/agents/*.md`, other docs) pointing to a moved section, and fix relative links inside moved content.

## Acceptance criteria

- [ ] Every resulting page, the hub included, stays under 300 lines.
- [ ] The hub has a summary, endpoint index, Source files and an index of all pages with one-line descriptions.
- [ ] No content is dropped or changed in meaning.
- [ ] All inbound links target the new pages and anchors.
- [ ] Relative links inside moved content still resolve.
