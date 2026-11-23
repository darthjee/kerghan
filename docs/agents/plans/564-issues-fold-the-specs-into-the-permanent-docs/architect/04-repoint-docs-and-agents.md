# Repoint permanent docs and agent files

Repoint every remaining link into `specs/issues` in the permanent docs and the agent files, using the mapping table, and add the repository-removal rule.

- `docs/agents/modules/workers.md`, `docs/agents/modules/integrations/github-service/issues.md`, `docs/agents/modules/integrations/github-service/api.md`, `docs/agents/architecture/frontend.md`: repoint the links.
- `docs/agents/modules/repositories.md`: repoint its links. Under *Not built*, next to "Removing a repo from Kerghan once added", add the rule: a future "remove an added repository" feature must refuse with `409` while a non-deleted project of the user uses the repository. Link it to `modules/issues/projects.md#linked-repository-unavailable-or-removed`. Do not decide the mechanism, which is still an open question in `data-model.md`.
- `.claude/agents/product-owner.md`:
  - Change the map row "Issues and Projects (active spec, #483) | `docs/agents/specs/issues.md`" to "Issues and Projects (#483) | `docs/agents/modules/issues.md`, `docs/agents/backend/routes/issues.md`, `docs/agents/product.md#issues-and-projects`".
  - Update the "Deferred" row (line 52), which mentions "using integration credentials for issues", to match the narrowed product.md item.
  - Review the carve-out example in line 90 ("opt-in issue persistence stays deferred while Issues and Projects persists Kerghan's own issues"). The carve-out is now between Deferred and a decided area, not an active spec, so reword it, or keep it as a generic example with no active spec named.
  - Line 23's example path `docs/agents/specs/issues.md` becomes a generic example (`docs/agents/specs/<feature>.md`).
- `.claude/agents/data-access.md` line 24: replace the example link "[Issues and Projects security](../../docs/agents/specs/issues/security.md)" with `../../docs/agents/modules/issues/security.md`, and say that folded features keep their security doc in the module docs that the *Completed specs* row points at.

## Files to Change

- `docs/agents/modules/workers.md`, `docs/agents/modules/integrations/github-service/issues.md`, `docs/agents/modules/integrations/github-service/api.md`, `docs/agents/architecture/frontend.md`: repointed links.
- `docs/agents/modules/repositories.md`: repointed links and the removal rule.
- `.claude/agents/product-owner.md`: the map row, the Deferred row and the examples.
- `.claude/agents/data-access.md`: the security-doc example.
