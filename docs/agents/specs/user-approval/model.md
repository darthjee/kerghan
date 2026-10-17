# User approval — Model

Data model and status lifecycle. Built by #392. Index: [README.md](README.md).

## `auth_users.status`

- New column `status` on `auth_users`, **NOT NULL**, one of `pending`, `approved`, `denied`.
- The status of a new row is set explicitly by the service that creates it (registration, boot
  sync, seeds), never left to an implicit default that could silently grant access.
- Not exposed in `user` payloads of the auth endpoints (`{ id, username, email, isAdmin }` stays
  unchanged); exposed only to admins, as the `status` field of the admin user items (see
  [api.md](api.md#admin-endpoints)), and to the caller through `status.json`'s `status: "pending"`
  (see [api.md](api.md#post-authstatusjson)).

## Transitions

```text
pending ──approve──▶ approved
   │                    │
   └──────deny──────▶ denied ◀──deny── (any status)
```

| Action | From | To | Rule |
|---|---|---|---|
| Approve | `pending` only | `approved` | Strict: any other status is refused (`422 USER_NOT_PENDING`) |
| Deny | any (`pending`, `approved`, `denied`) | `denied` | Lenient: covers reject (from `pending`) and ban (from `approved`); denying an already `denied` user is a successful no-op on the status (sessions are still revoked) |

- **`denied` is final**: no transition leaves it.
- Status changes **only** through approve and deny. The admin edit route
  (`POST /admin/users/:id/edit.json`), My Account (`PATCH /auth/account.json`), password reset
  and every other write path never change `status`.
- No automatic transition: turning `KERGHAN_USER_APPROVAL_REQUIRED` on or off changes no
  existing user.

## Migration

One migration adds the column and **backfills every existing user to `approved`**, in the same
deploy as the gate's `approved` requirement. The backfill is mandatory: the gate is always
enforced, so any user left without `approved` would be locked out.

Its `down` drops the column.

## Registration

`POST /auth/register.json` creates the user with the status given by
`KERGHAN_USER_APPROVAL_REQUIRED` (off → `approved`, on → `pending`); see
[README.md](README.md#the-flag). Registration still mints a session either way (see
[api.md](api.md#post-authregisterjson)).

## Default user

While the default-user feature is enabled, `status` becomes a **managed field** of the default
user (see [Default user](../../modules/auth/default-user.md)): the boot sync forces it to
`approved` on every boot, whether the row is created or updated. So a default user denied
directly in the DB is approved again on the next boot, and the admin deny route refuses it
(`409 DEFAULT_USER_MANAGED`, see [api.md](api.md#post-adminusersidenyjson)). With the feature
off, boot sync does not run and that row is a regular user.

At fold-in, #394 adds `status` (forced `approved` by boot sync, deny refused with `409`) to the
managed-field lists in [Default user](../../modules/auth/default-user.md) (Edit blocking, Future
write paths) and in [product.md](../../product.md#default-user), and adds a short "User approval"
section to `product.md`.

## Demo seed users

The demo users seeded for dev/manual testing are `approved`. The existing seed migrations run
before the `status` migration, so the backfill covers them; any seed added after it inserts
`approved` explicitly.

## Required tests

- **Migration:** existing users (including the demo seed) are `approved` after it runs; the
  column is NOT NULL and rejects other values.
- **Registration:** flag off → `approved`; flag on → `pending`.
- **Flag flip:** turning the flag on or off leaves every existing user's status unchanged.
- **Default user:** boot sync creates it `approved`, and forces a `pending` or `denied` default
  user back to `approved`.
- **Transitions:** approve from `pending` succeeds; approve from `approved` or `denied` is
  refused; deny succeeds from each status; nothing leaves `denied`; admin edit and My Account
  never change `status`.
