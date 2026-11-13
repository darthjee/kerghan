# Spec sync

Keep `docs/agents/specs/repos/` the source of truth for what this PR built, and list every spec change in the PR description.

- **`model.md#auth-export`:** document the new `AccountHandleService` manager-aware, `FOR SHARE` existence read, and that it is the only Auth read Repositories runs inside its own transaction.
- **`model.md#user-deletion`:** name `auth/events/user-deleted.event.ts` (`USER_DELETED`, `UserDeletedEvent`) and say how the shared lock closes the race with a concurrent delete.
- **`integrations.md#exported-service`:** add `listIntegrations(userId): Promise<IntegrationRef[]>` (all integrations, oldest first) and say who uses it (the non-usable sources, the safety net, the link fill, and the listing's source labels). Update `testing.md#repositories-typed-fake` / `#fake-fidelity` if the fake's surface listing names methods.
- **`integrations.md#required-tests`:** mark the `(db)` compare-and-set and the listener-at-boot case as done in #463.
- **`README.md`:** add the #463 row to the "Sub-issues" table:
  - title: "Repositories: backend module, tables and sync engine";
  - files: implementation of `model.md`, `sync.md` and `edge-cases.md`;
  - spec sync in `model.md` and `integrations.md`.
- Any other mismatch found while implementing: fix the spec, and note it in the PR.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, `environment-variables.md`) change: #452 folds them in.

## Files to Change
- `docs/agents/specs/repos/model.md`, `integrations.md`, `testing.md` (if needed), `README.md`.
