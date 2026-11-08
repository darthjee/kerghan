# README

Update `docs/agents/specs/repos/README.md`:

- **Open markers:** remove the three #450 rows (user deletion, sync edge cases, UI edge cases).
  Only the #451 row remains.
- **Index:** add `edge-cases.md`, "Every edge case, its outcome and the rule behind it".
- **Sub-issues:** #450's "Spec files it touches" becomes `edge-cases.md` (new) plus every file.
- **Scope, out of scope:** reword "Changing an added repo's access link after Add" to say that
  filling an empty or dangling link at the end of a sync is not a change of a valid link.
- **Decisions summary:** one bullet per rule in the issue's "Rule changes at a glance" table,
  each linking to its owning anchor, plus the accepted "non-usable rows kept" case. Also link
  `edge-cases.md`.
- **Product changes folded by #452:** add the entries for:
  - the `user.deleted` contract (`modules/auth.md`, the Repositories module doc);
  - `409 REPOSITORY_SOURCE_UNUSABLE` (`backend/routes/repositories.md`, `core/error-codes.ts`);
  - the `not_found` source status;
  - the `integrations` status compare-and-set on `secret_iv` (`modules/integrations.md`);
  - the edge-case matrix becoming the Repositories module's "Edge cases".

## Files to Change

- `docs/agents/specs/repos/README.md` — open markers, index, sub-issues, scope, decisions,
  #452 checklist.
