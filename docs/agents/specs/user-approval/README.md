# User approval

Temporary feature specs for the optional **admin approval of new user registrations**. Product
decision: #389. Lifecycle and conventions: [Feature Specs](../../specs.md).

## Overview

Today anyone who registers gets a working account immediately. This feature lets an instance
require an admin to approve each new registration before the account can use Kerghan, and lets
admins deny (reject or ban) any account.

Every user has a `status`: `pending`, `approved` or `denied`. Only `approved` users are treated
as authenticated. `pending` and `denied` users are treated as anonymous by every business
endpoint; a small set of auth endpoints reads the real status explicitly (see
[security.md](security.md#explicit-exceptions)).

## The flag

`KERGHAN_USER_APPROVAL_REQUIRED` — optional boolean flag, **default off**, parsed like the other
`KERGHAN_*` boolean flags (see [environment-variables.md](../../environment-variables.md)).

It decides **only** the initial status of a new self-registration:

| Flag | Status of a new registration |
|---|---|
| off (default) | `approved` |
| on | `pending` |

It never:

- changes the status of existing users, when it is turned on or off;
- disables the authentication gate (the `approved` requirement is always enforced);
- hides or disables the admin review tools (status filter, approve, deny), which are always
  available.

Its row in `environment-variables.md` is added by #392, the sub-issue that starts consuming it.

## Scope

In scope: the `status` model, the session-lookup gate in `JwtGuard`, the status-aware auth
endpoints, the admin status filter / approve / deny endpoints, and the matching frontend
(awaiting-approval view, denied login message, admin page actions).

Out of scope:

- **Notifications**: approve and deny send nothing; admins are not alerted of new pending
  registrations.
- **Pagination** of the admin user listing (separate issue).
- **Leaving `denied`**: there is no un-deny; `denied` is final.
- **Slimming the JWT payload** to `{ sub, sid }`: a possible later cleanup.

## Index

| File | Defines |
|---|---|
| [model.md](model.md) | The `status` column, transitions, migration backfill, registration status, default user and demo seeds |
| [security.md](security.md) | The `sid` claim, the session-lookup gate, `request.user` from the DB, `sid`-less tokens, explicit exceptions, non-disclosure |
| [api.md](api.md) | Every changed and new endpoint: auth user endpoints, admin search / approve / deny, error codes, revoked reason, cache policy |
| [ui.md](ui.md) | Awaiting-approval view and re-check, denied login message, admin page status filter and actions |

## Sub-issue map

| Issue | Builds | Reads |
|---|---|---|
| #391 | Session-lookup gate: `sid` claim, `JwtGuard` session lookup, `request.user` from the DB (no status logic yet) | [security.md](security.md) |
| #392 | User-side flow, backend and frontend: `status` column, flag, `approved` requirement in the gate, auth endpoints, awaiting-approval UI | [model.md](model.md), [security.md](security.md), [api.md](api.md) (user endpoints), [ui.md](ui.md) (user side) |
| #393 | Admin review, backend and frontend: status filter, approve, deny | [api.md](api.md) (admin endpoints), [ui.md](ui.md) (admin side) |
| #394 | Fold these specs into the permanent docs and delete this folder | all |

## Required tests

The flag's parsing follows the shared boolean-flag parser and its existing tests; #392 adds the
flag to that coverage (unset → off, accepted true / false values, invalid value handled like the
other `KERGHAN_*` flags). Every other rule is tested from the "Required tests" section of the
file that defines it.
