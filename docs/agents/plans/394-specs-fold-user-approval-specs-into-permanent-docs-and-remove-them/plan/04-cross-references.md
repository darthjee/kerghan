# Frontend, default-user, product and env docs

Make short, targeted updates so every permanent doc that touches the feature links to it.

- **`docs/agents/architecture/frontend.md`, "Auth flow"**: a short paragraph on the `pending`
  state carried on `AuthEvents` (`loggedIn` / `isAdmin` false), the `status.json` re-check after
  register and login, and the awaiting-approval view. Note that `ApiClient` does not
  refresh-and-retry on `403 USER_DENIED`. Link to
  `../modules/auth/user-approval.md#frontend` for the details. Add the admin client methods
  (`approve` / `deny`) to the client list if the code has them.
- **`docs/agents/modules/auth/default-user.md`**: add `status` (forced to `approved` by boot sync,
  deny refused with `409`) to "Edit blocking" / "What is blocked", to "Future write paths", and
  to the boot sync description.
- **`docs/agents/product.md`**: add `status` to the managed-field list under "Default user". Add a
  short "User approval" section (what it does, off by default, admins can always approve and
  deny, `denied` is final) with a link to `modules/auth/user-approval.md`. Product decision #389.
- **`docs/agents/environment-variables.md`**: check that the `KERGHAN_USER_APPROVAL_REQUIRED` row
  in section 1 says it is parsed like the other `KERGHAN_*` boolean flags. Point the
  "Documented in" or notes cell at `modules/auth/user-approval.md` if the table has one. No other
  change is expected.

## Files to Change
- `docs/agents/architecture/frontend.md` — pending-state note and link
- `docs/agents/modules/auth/default-user.md` — `status` as a managed field
- `docs/agents/product.md` — default-user managed fields and a new "User approval" section
- `docs/agents/environment-variables.md` — verify the flag row and add a link if needed
