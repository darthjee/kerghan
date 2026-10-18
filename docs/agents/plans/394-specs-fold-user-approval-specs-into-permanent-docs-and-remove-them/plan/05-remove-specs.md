# Delete the spec folder and update the specs hub

1. Re-read each spec file against the permanent docs (steps 01–04) and confirm that every
   decision is covered. The only things left out on purpose are the sub-issue map, the delivery
   order, the "#394 adds …" notes and the "Required tests" lists.
2. Delete `docs/agents/specs/user-approval/` (`git rm -r`).
3. In `docs/agents/specs.md`:
   - **Active specs**: remove the user-approval row and leave the list reading "none". Follow the
     existing "When no feature is in progress, this list reads 'none'" convention.
   - **Completed specs**: add this row:
     `| User approval (optional admin approval of new registrations) | [modules/auth/user-approval.md](modules/auth/user-approval.md) (status model, flag, exceptions, non-disclosure, admin review, frontend); [modules/auth.md](modules/auth.md) (session-lookup gate, sid claim, immediate revocation, logged → denied); [backend/routes/auth.md](backend/routes/auth.md) (status-aware auth endpoints, USER_DENIED); [environment-variables.md](environment-variables.md) (KERGHAN_USER_APPROVAL_REQUIRED); [product.md](product.md#user-approval) | #389 |`
4. Run `grep -rn "specs/user-approval" docs AGENTS.md CLAUDE.md README.md backend frontend`. It
   must return nothing outside `docs/agents/issues/` and `docs/agents/plans/`. Fix any link it
   finds, including source-code comments that point at the spec. Those are comment-only edits,
   not code changes.
5. Check that every new or changed relative link resolves, especially the anchors
   `#frontend`, `#user-approval`, `#sessions` and `#status-machine`.

## Files to Change
- `docs/agents/specs/user-approval/` — deleted
- `docs/agents/specs.md` — Active specs set to "none", new Completed specs row
