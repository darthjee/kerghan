# api.md and security.md knock-ons

**`api.md`:**

- **Add, step 5:** pin the candidate walk (order, `401`/`403`/`404` → next, transient → stop,
  at most 3 GitHub calls, denials everywhere → `404`), linking `integrations.md`; remove "whether
  Add then tries the next…" open wording.
- **Unauthenticated re-check:** Add is refused only at remaining ≤ 0 (its own threshold).
- **Errors:** the `502`/`503` helpers live in `core/github-http-errors.ts`; replace "where they
  live once shared is #448's".

**`security.md`:**

- **Credentials stay in the backend:** replace the open note with the interface guarantees
  (no credential, minted token or GitHub body leaves the module; foreign ids refused without a
  call; tokens minted with `metadata: read`, in memory only).
- **Fixed GitHub base URL:** replace "the authenticated client (Integrations) and the
  unauthenticated one (Repositories)" with the single Integrations client, with or without a
  credential; `redirect: 'manual'`, classified as `redirect`, never followed.
- **Add verification:** reword "the unauthenticated re-check honours the low-budget threshold"
  to Add's own threshold (≤ 0) and the 3-call cap.
- **Abuse and performance:** mention the reservations (no overshoot from parallel calls).
- **Required tests:** add the security-side tests (no leak of credential/token/body, no
  `Authorization` when unauthenticated, minted with `metadata: read`).

## Files to Change
- `docs/agents/specs/repos/api.md` — Add step 5, unauthenticated threshold, helpers location.
- `docs/agents/specs/repos/security.md` — interface guarantees, single client, threshold wording, reservations, required tests.
