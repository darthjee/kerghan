# README and Active specs entry

Create `docs/agents/specs/user-approval/README.md` and list the feature in `docs/agents/specs.md`.

The README holds:

- **Overview and purpose:** optional admin approval of self-registered accounts; product
  decision #389.
- **The flag:** `KERGHAN_USER_APPROVAL_REQUIRED` (optional boolean flag, default off, same
  parsing as the other `KERGHAN_*` flags). It only decides the initial status of new
  registrations (off → `approved`, on → `pending`); it never changes existing users, never
  disables the gate, and never hides the admin review tools.
- **Scope / out of scope:** no notifications (approve / deny send nothing, admins are not
  alerted), no pagination of the admin user listing (separate issue), no way out of `denied`,
  no slimming of the JWT payload.
- **Index** of `model.md`, `security.md`, `api.md`, `ui.md`, each with one line on what it
  defines.
- **Sub-issue map:** #391 (security.md: session-lookup gate), #392 (model, security, api user
  endpoints, ui user side), #393 (api admin endpoints, ui admin side), #394 (fold and remove).
- A "Required tests" section only if a README-level rule needs one (e.g. the flag's parsing);
  otherwise point at the per-file sections.

In `docs/agents/specs.md`, replace "none" under "Active specs" with an entry linking
`specs/user-approval/README.md` and naming #389 as the product decision.

## Files to Change
- `docs/agents/specs/user-approval/README.md` — new: overview, flag, scope, index, sub-issue map.
- `docs/agents/specs.md` — add the feature under "Active specs".
