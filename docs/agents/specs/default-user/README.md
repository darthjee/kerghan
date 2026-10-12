# Default user — specs

Temporary feature specs for epic #366, following the [specs hub](../../specs.md). While this
folder exists it is the source of truth for the default-user feature: every sub-issue of the
epic builds against it and does not redefine what it decides. #366's body is no longer kept up to
date. A sub-issue that needs to change a decision updates the relevant file here in the same PR.

## Overview and purpose

Given certain environment variables, Kerghan treats a configured user as authenticated without a
manual login:

- **Default user.** The backend creates a user at boot from environment variables (username,
  email, password, admin flag), or synchronizes it if it already exists. The environment is the
  source of truth for that user.
- **Always-on authentication (optional).** A second flag makes a client with no valid session log
  in automatically as the default user. The automatic login happens only in `status.json`, which
  the frontend calls on load, and only for allowed client IPs. It issues real cookies and a real
  session, exactly as `login.json` does.

The feature is aimed mainly at the standalone distribution, where a fresh installation opens
already logged in. It is also available online, behind an IP allowlist and a production guard.

## Product decision

Epic #366. The decisions recorded in these files come from that epic. Re-discussing them is out of
scope for the sub-issues.

## Scope

### In scope

- The `KERGHAN_DEFAULT_USER_*` variables and the `DefaultUserConfig` class that reads and validates
  them ([configuration.md](configuration.md)).
- Creating or synchronizing the default user at boot ([boot-sync.md](boot-sync.md)), and blocking
  writes of the fields the environment manages ([edit-blocking.md](edit-blocking.md)).
- Automatic login in `status.json` ([automatic-login.md](automatic-login.md)).
- The security rules: IP allowlist, production guard, session flooding, credentials, admin access
  ([security.md](security.md)).
- The standalone wiring: compose pass-through, `kerghan.env` defaults, the `auto-login` and `bind`
  settings and flags ([standalone.md](standalone.md)).
- A client command that adds missing variables to an existing `kerghan.env`
  ([standalone.md](standalone.md#existing-installations)).

### Out of scope

- **Frontend changes.** With login happening only in `status.json`, the frontend simply sees a
  logged-in user. Hiding logout or showing an "automatic login" indicator is a separate issue.
- **More than one default user.**
- **Removing a previously created default user** when the flag is turned off. It stays untouched.
- **Changing the existing demo-user seed migration.**
- **Turning the feature on in any production deployment** (for example Render).

## Alternatives

- **Chosen: automatic login in `status.json`.** Real cookies and a real session, so refresh, the
  session list, revocation, `AdminGuard` and the frontend all work unchanged.
- **Rejected: bypassing authentication in the guard** (filling `request.user` without issuing
  tokens). Session-dependent features (the session list, revocation, logout) and the frontend's
  `status.json` would all need special handling.
- **Rejected: automatic login in `JwtGuard`.** It would flood the refresh-token table; see
  [security.md](security.md#session-flooding).

## Open items

This is not decided yet.

- **The effective client IP inside Docker-in-Docker / Tent.** Open technical risk, owned by #371.
  See [standalone.md](standalone.md#open-risk-effective-client-ip).

#374 and #375 edit files created here, so they start only after #367 is merged.

## Variables live only here for now

While this spec is active, the `KERGHAN_DEFAULT_USER_*` variables are documented only in
[configuration.md](configuration.md), not in `environment-variables.md`. This temporary split is
intended: #373 folds them into the permanent docs. Do not "fix" it early.

## Lifecycle

- **#373** folds the lasting content into the permanent docs (`environment-variables.md`,
  `standalone.md`, `modules/`, `backend/routes/`, …), including the security warnings (admin
  access, IP allowlist, production guard). It then deletes this folder and moves the hub entry
  from "Active specs" to "Completed specs".

Root instruction files and agents link only to the hub, never to this folder.

## Sub-issue map

| # | Sub-issue | Owner | Reads | Depends on |
|---|---|---|---|---|
| #367 | Specs: default user feature definition | architect | all | none |
| #374 | Specs: API contract for edits blocked on the default user | architect | [edit-blocking.md](edit-blocking.md) | #367 |
| #375 | Specs: `status.json` contract for automatic login | architect | [automatic-login.md](automatic-login.md) | #367 |
| #368 | Backend: `DefaultUserConfig` | backend | [configuration.md](configuration.md), [security.md](security.md) | #367 |
| #369 | Backend: boot-time sync and edit blocking | backend | [boot-sync.md](boot-sync.md), [edit-blocking.md](edit-blocking.md) | #368, #374 |
| #370 | Backend: automatic login in `status.json` | backend (+ security review) | [automatic-login.md](automatic-login.md), [security.md](security.md) | #368, #369, #375 |
| #371 | Standalone: wiring, `auto-login` and `bind` | standalone (+ infra if the image changes) | [standalone.md](standalone.md), [security.md](security.md) | #370 |
| #372 | Standalone: `kerghan.env` update command | standalone | [standalone.md](standalone.md#existing-installations) | #371 |
| #373 | Specs: fold into permanent docs and remove the specs | architect | all | all |

Order: #367, then #374, #375 and #368 (in parallel), then #369, #370, #371, #372, and finally #373.
#371 waits for #370 so it can confirm end to end which client IP reaches the backend.

## Index

| File | Content | Implemented by |
|---|---|---|
| [configuration.md](configuration.md) | The variables, `DefaultUserConfig`, flag rules, boot validation | #368 |
| [boot-sync.md](boot-sync.md) | Creating or synchronizing the user at boot | #369 |
| [edit-blocking.md](edit-blocking.md) | API contract for writes refused on the default user (edit, recovery, reset) | #369 |
| [automatic-login.md](automatic-login.md) | Automatic login in `status.json`, its response contract, boot warning, turning it off | #370 (contract by #375) |
| [security.md](security.md) | IP allowlist, production guard, session flooding, credentials, admin access | #368, #370, #371 |
| [standalone.md](standalone.md) | Compose pass-through, `kerghan.env` defaults, `auto-login`, `bind`, update command, open IP risk | #371, #372 |

## Required tests

This file has none of its own. Each file above ends with its own "Required tests" section.
