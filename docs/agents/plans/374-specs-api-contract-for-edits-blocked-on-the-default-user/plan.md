# Plan: Specs: API contract for edits blocked on the default user

Issue: [374-specs-api-contract-for-edits-blocked-on-the-default-user.md](../../issues/374-specs-api-contract-for-edits-blocked-on-the-default-user.md)

## Overview

Spec-only change, owned by the architect (no specialist agent has work). Add a new file,
`docs/agents/specs/default-user/edit-blocking.md`, holding the API contract for writes refused on
the environment-managed default user. Then point `boot-sync.md` and the folder's `README.md` at it,
replacing the "#374" placeholders. No code changes.

## Context

`boot-sync.md`'s "Edit blocking" section and the specs `README.md`'s "Open items" both carry a
"to be defined by #374" placeholder for the HTTP status, error code and response body. #369
implements the blocking and must not make any API decision of its own. The issue's
"Expected Behavior" section holds every decision; this plan transcribes them into the spec.

## Implementation Steps

### Step 1 — Write `edit-blocking.md`

Create `docs/agents/specs/default-user/edit-blocking.md`, following the style of the sibling files
(`boot-sync.md`, `configuration.md`): a top line "Implemented by #369 (contract by #374). Part of the
[default-user specs](README.md).", then sections taken from the issue's "Expected Behavior":

1. **Scope of the block**: while `DefaultUserConfig.isEnabled()` is true; managed fields
   (`username`, `email`, password, admin flag); the six endpoints covered.
2. **Identifying the default user**: by the id boot sync recorded for the row it created or
   matched, never by comparing username strings (case- and accent-insensitive collation). Where the
   id is held is #369's choice. No id is held while disabled.
3. **Response**: `409 Conflict`, code `DEFAULT_USER_MANAGED` (to be added to
   `backend/src/core/error-codes.ts` by #369), message
   `This user is managed by environment configuration and cannot be edited`, standard
   `http-exception.filter.ts` body with no `error.details`, plus the JSON example. Include the short
   rationale and the rejected alternatives (`403`, `423`, `422`).
4. **Rule: per field, by presence**: any managed field present → `409`, even when its value is
   unchanged; future unmanaged fields stay editable; no-field requests keep their existing `400`.
5. **Order of checks**: the numbered sequences for `AccountService.updateAccount` (block right
   after `assertAnyFieldPresent`, before lockout/load/password) and `AdminService.editUser` (block
   after the `404` user load, before availability). State the abuse-guard consequences: no password
   oracle, never counts, no reset, `409` wins over `423`.
6. **Password recovery and reset**: the four-row endpoint table (`recover.json` silent `200`, no
   token and no email; `reset-password.json` validates the token first, then `409` with no write and
   the token not consumed; both admin recovery endpoints `409` after `404`, with no token and no
   email).
7. **Edge cases**: changed username between boots, off-then-on, the default admin editing itself,
   other users claiming the username or email, tokens issued before enabling.
8. **Compatibility**: no change while disabled; additive error code; no reordering of existing
   checks; frontend unchanged (generic `error.message` display; `409` avoids the admin form's `403`
   redirect); #369 confirms the reset-password page shows the message.
9. **Future write paths**: no endpoint edits `is_admin` today; any future write of a managed field
   applies the same `409` block before any write, except public endpoints that must not reveal the
   default user, which follow the `recover.json` precedent.
10. **Required tests**: the list from the issue's "Required tests" section, plus the edit-blocking
    bullet moved out of `boot-sync.md`.

Keep wording consistent with the issue. Do not add decisions the issue doesn't make.

### Step 2 — Update `boot-sync.md` and the specs `README.md`

- `boot-sync.md`, "Edit blocking" section:
  - keep the motivation bullets (rename, silent revert) and "the blocking logic lives in the
    services";
  - replace the bold "to be defined by #374; do not implement before then" paragraph with a
    one-line summary (`409 DEFAULT_USER_MANAGED`, also covering password recovery and reset) and a
    link to [edit-blocking.md](edit-blocking.md);
  - add a "Boot sync records the default user's id" note linking to `edit-blocking.md`'s
    identification section, since boot sync has to provide it;
  - in "Required tests", replace the last bullet ("While enabled, edits of username, …") with a
    pointer to `edit-blocking.md`'s "Required tests", and add a bullet "Boot records the id of the
    row it created or matched".
  - Update the header line to "Implemented by #369 (edit-blocking contract in
    [edit-blocking.md](edit-blocking.md))".
- `README.md` (same folder):
  - "In scope": change the boot-sync bullet to "Creating or synchronizing the user at boot
    ([boot-sync.md](boot-sync.md)), and blocking writes of the fields the environment manages
    ([edit-blocking.md](edit-blocking.md))".
  - "Open items": remove the #374 bullet, and change the lead sentence about placeholders so it
    names only #375.
  - Sub-issue map: #374's "Reads" becomes [edit-blocking.md](edit-blocking.md) (it writes it);
    #369's "Reads" becomes [boot-sync.md](boot-sync.md), [edit-blocking.md](edit-blocking.md).
  - Index: change the `boot-sync.md` row's content to "Creating or synchronizing the user at boot"
    (implemented by #369), and add a row for
    `[edit-blocking.md](edit-blocking.md) | API contract for writes refused on the default user (edit, recovery, reset) | #369`.
- `docs/agents/specs.md` hub: no change (it links only to the folder's `README.md`).

## Files to Change

- `docs/agents/specs/default-user/edit-blocking.md` — new: the full contract, ending with
  "Required tests".
- `docs/agents/specs/default-user/boot-sync.md` — replace the #374 placeholder with a pointer;
  note the recorded id; move the edit-blocking test bullet.
- `docs/agents/specs/default-user/README.md` — In scope, Open items, sub-issue map, Index.

## Notes

- Spec only: do not touch `backend/` (the `DEFAULT_USER_MANAGED` code is added by #369), the error
  filter or the frontend.
- No CI job covers these markdown files.
- Root instruction files and agents link only to the specs hub, never to this folder. Do not add
  links to `edit-blocking.md` anywhere outside `docs/agents/specs/default-user/`.
- Before committing, check that every relative link in the three files resolves.
