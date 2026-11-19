# Plan: Docs: docs/agents/modules/auth.md is 516 lines — split into hub + focused pages

Issue: [519-docs-docs-agents-modules-auth-md-is-516-lines-split-into-hub-focused-pages.md](../../issues/519-docs-docs-agents-modules-auth-md-is-516-lines-split-into-hub-focused-pages.md)

## Overview
Docs-only reorganization, done by the architect (no specialist agent owns `docs/`). `docs/agents/modules/auth.md` becomes a hub and its sections move, unchanged, into four new pages under `docs/agents/modules/auth/`. Same pattern as #509–#518.

## Context
`auth.md` is 516 lines (cap: 300). Current sections and line ranges:

| Lines | Section | Destination |
|---|---|---|
| 1–8 | Intro | stays in hub |
| 9–116 | Routes, Admin tool routes, CSRF protection, Exports | `auth/routes.md` |
| 117–308 | Entities (`auth_` prefix), JWT/refresh-token flow | `auth/sessions.md` |
| 309–402 | Device-authorization flow (Entity, routes, status machine, poll-token contract, enumeration safety, hardening limits) | `auth/device-authorization.md` |
| 403–426, 456–487 | Admin authorization, `user.registered`, `user.deleted`, `password-recovery.requested` events | `auth/admin-and-events.md` |
| 427–455 | Default user, GitHub handle, User approval (short sections) | replaced by index entries for the existing `default-user.md`, `github-handle.md`, `user-approval.md` |
| 488–516 | Testing | stays in hub |

Note: `auth/default-user.md` is already 406 lines; it predates this issue and is out of scope.

## Implementation Steps

### Step 1 — Split the file
- Create `auth/routes.md`, `auth/sessions.md`, `auth/device-authorization.md`, `auth/admin-and-events.md`, each with an `# H1` title and the moved sections verbatim (keep heading text so anchors stay identical; do not rewrite content). Page boundaries may be adjusted if a page would reach 300 lines.
- Before deleting the short Default user / GitHub handle / User approval sections from the hub, check that nothing in them is missing from the existing `default-user.md`, `github-handle.md`, `user-approval.md`; if something is, move it there rather than dropping it.
- Fix relative links inside moved content (one directory deeper: `../` → `../../`, links to sibling module pages gain a `../`). Links between the new pages and to anchors still in the hub must resolve.
- Trim `auth.md` to intro (1–2 paragraph summary) + Testing, and end it with an index linking all seven pages under `auth/` (four new plus the three existing), each with a one-line "read when" description.
- Verify every new/changed page is under 300 lines (`wc -l`).

### Step 2 — Update inbound links
Retarget every link/anchor pointing at a moved section, using the mapping:
- `#routes`, `#admin-tool-routes-admincontroller-admin-prefix`, `#csrf-protection`, `#exports` → `auth/routes.md`
- `#entities-auth_-table-prefix`, `#jwtrefresh-token-flow` → `auth/sessions.md`
- `#device-authorization-flow`, `#entity`, `#device-authorization-routes`, `#status-machine`, `#poll-token-contract`, `#enumeration-safety`, `#hardening-limits-…` → `auth/device-authorization.md`
- `#admin-authorization`, `#userregistered-event`, `#userdeleted-event`, `#password-recoveryrequested-event` → `auth/admin-and-events.md`
- `#default-user`, `#github-handle`, `#user-approval` → the existing pages
- `#testing`, bare `auth.md` → unchanged (hub)

Known inbound links (re-run `grep -rn 'auth\.md' docs AGENTS.md .claude` to be exhaustive):
- With anchors: `docs/agents/backend/routes/auth.md` (lines ~93, 224, 315, 390, 425, 426), `docs/agents/modules/auth/user-approval.md` (~18, 108, 129, 136), `docs/agents/modules/repositories/data-model.md` (~181).
- Prose references naming a section (update to name the new page): `docs/agents/backend/routes/auth.md` (~199), `docs/agents/architecture/frontend.md` ("Device-authorization flow", ~76), `docs/agents/architecture/backend.md` ("JWT/refresh-token flow" ~156, "Admin authorization" ~168, entities ~81).
- Plain hub links that stay valid (check only whether a more precise target is worthwhile): `.claude/agents/security.md`, `docs/agents/{product,summary,flow,folder-structure,specs}.md`, `docs/agents/architecture/{modular-pattern,security,frontend,backend}.md`. In `docs/agents/specs.md` rows mentioning `modules/auth.md`, add the new pages where the row lists module pages.

## Files to Change
- `docs/agents/modules/auth.md` — slim to hub + index
- `docs/agents/modules/auth/{routes,sessions,device-authorization,admin-and-events}.md` — new
- Inbound-link files listed in Step 2

## CI Checks
None apply (markdown only; no code changes).

## Notes
- Do not confuse `docs/agents/backend/routes/auth.md` (the route contracts, different file) with `modules/auth.md`: only links resolving to `modules/auth.md` change.
- Verify afterwards with a link check: every `](...auth...)` target and anchor resolves; `grep -rn 'modules/auth.md#'` and `'\.\./auth.md#'` should show only hub anchors (`testing`).
- Section headings must keep their exact text so GitHub anchors remain computable (e.g. `Entities (`auth_` table prefix)` → `#entities-auth_-table-prefix`).
