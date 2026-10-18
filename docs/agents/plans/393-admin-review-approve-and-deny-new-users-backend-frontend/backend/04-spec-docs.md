# Record currentUserId in the specs

Record the plan decision so #394's fold-in carries it:

- `api.md`, `POST /admin/users/search.json`: response becomes
  `{ users: [ <user item> ], currentUserId }`, with one line on why (lets the admin page hide
  deny on the caller's own row; admin-only, discloses nothing new). Add it to the Search
  required tests.
- `ui.md`, *Admin side*: "no deny on the admin's own row" is decided by comparing each row's
  `id` with `currentUserId` from the last search response.

## Files to Change

- `docs/agents/specs/user-approval/api.md` — `currentUserId` in the search response.
- `docs/agents/specs/user-approval/ui.md` — how the own row is identified.
