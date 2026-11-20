# Plan: Docs: docs/agents/modules/auth/default-user.md is 406 lines — split into hub + focused pages

Issue: [527-docs-docs-agents-modules-auth-default-user-md-is-406-lines-split-into-hub-focused-pages.md](../../issues/527-docs-docs-agents-modules-auth-default-user-md-is-406-lines-split-into-hub-focused-pages.md)

## Overview
Pure documentation reorganization, owned by the architect (docs only; no specialist agent has work).
`docs/agents/modules/auth/default-user.md` (406 lines) becomes a hub, and its sections move verbatim
into four pages under `docs/agents/modules/auth/default-user/`. Every inbound link and anchor is
retargeted, and relative links inside the moved content are fixed for the extra directory level.

## Context
The file exceeds the 300-line cap in AGENTS.md. Same pattern as the earlier splits (#509–#511,
#520–#524). Section line ranges in the current file: Overview 8–25, Configuration 26–55,
Boot sync 56–98, Edit blocking 99–265, Automatic login 266–322, Security 323–381,
Out of scope 382–390, Testing 391–406.

## Implementation Steps

### Step 1 — Create the pages and slim the hub
- Create `default-user/configuration.md`: `## Configuration` and `## Boot sync` (with Password,
  Collisions and races, Disabled), each page headed by a `# Default user: …` title and a
  "Part of the [Default user](../default-user.md) hub" line.
- Create `default-user/edit-blocking.md` (~170 lines): all of `## Edit blocking` and its
  subsections.
- Create `default-user/automatic-login.md`: `## Automatic login`, Boot warning, Turning it off,
  Why only `status.json`.
- Create `default-user/security.md`: `## Security` and its subsections.
- Move text verbatim; only change what is needed so links still work:
  - add one `../` to relative links that leave `modules/auth/` (e.g. `../../standalone.md` →
    `../../../standalone.md`, `../../backend/routes/auth/…` → `../../../backend/routes/auth/…`,
    `../../environment-variables/…`, `../../standalone/…`);
  - sibling links (`user-approval.md`, `github-handle.md`) become `../user-approval.md`,
    `../github-handle.md`;
  - intra-document anchors that now cross pages are retargeted: `#identifying-the-default-user`
    and `#future-write-paths` stay within edit-blocking; `#identifying-the-default-user` used in
    Boot sync becomes `edit-blocking.md#identifying-the-default-user`.
- Slim the hub `default-user.md`: keep the 1–2 paragraph summary, Overview, Out of scope and
  Testing, and add a "Pages" index with a one-line "read when" per page.

### Step 2 — Retarget inbound links and verify
Update links that point to moved sections (anchors in parentheses → new page):
- `environment-variables/backend.md` lines 68, 72, 73, 74: `#automatic-login` →
  `default-user/automatic-login.md`; `#admin-access`, `#ip-allowlist`, `#production-guard` →
  `default-user/security.md#…`. Line 67 (no anchor) stays.
- `environment-variables/backend-setup.md:29` (`#boot-sync`) → `default-user/configuration.md#boot-sync`.
- `standalone/client-config/security.md:8` (`#boot-sync`) and `wizard.md:42` (`#configuration`)
  → `default-user/configuration.md#…`.
- `backend/routes/auth/login.md:146` (`#automatic-login`) → `default-user/automatic-login.md`;
  `backend/routes/auth/shared.md:10` (`#edit-blocking`) → `default-user/edit-blocking.md`.
- `modules/auth/github-handle.md` lines 99, 131 (`#order-of-checks`, `#what-is-blocked`) →
  `default-user/edit-blocking.md#…`.
- `modules/auth/user-approval.md:175` (`#identifying-the-default-user`) and
  `modules/auth/routes.md:82` (`#edit-blocking`) → `default-user/edit-blocking.md#…`.
- Links to the hub with no anchor or with `#testing` / `#out-of-scope`
  (`auth.md`, `summary.md`, `product.md`, `standalone.md`, `config-files.md`, `specs.md`, etc.)
  keep working; additionally list the new pages in the `specs.md` "Default user" row
  (and the `modules/auth.md` index row if appropriate).
- Re-run `grep -rn 'default-user.md#'` across the repo to catch anything missed; verify every
  relative link in the new pages resolves (e.g. a small script checking file existence and
  heading anchors), and check `wc -l` is under 300 for the hub and each page.

## Files to Change
- `docs/agents/modules/auth/default-user.md` — slim to hub plus page index
- `docs/agents/modules/auth/default-user/{configuration,edit-blocking,automatic-login,security}.md` — new
- `docs/agents/environment-variables/backend.md`, `backend-setup.md` — anchors retargeted
- `docs/agents/standalone/client-config/security.md`, `wizard.md` — anchors retargeted
- `docs/agents/backend/routes/auth/login.md`, `shared.md` — anchors retargeted
- `docs/agents/modules/auth/github-handle.md`, `user-approval.md`, `routes.md` — anchors retargeted
- `docs/agents/specs.md`, `docs/agents/modules/auth.md` — mention the new pages

## Notes
- No code or CI impact; docs only. Content must not be reworded or dropped.
- Anchors inside this file already moved between sections must be checked after the split
  (e.g. `#default-user` anchors that point at other docs are unaffected).
