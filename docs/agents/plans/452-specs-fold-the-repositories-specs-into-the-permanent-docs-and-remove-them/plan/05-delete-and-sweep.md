# Delete the specs, close the lifecycle, link sweep

Commit 4: remove the specs and verify that nothing still points at them.

1. Tick every item of the README's "Product changes folded by #452" checklist against steps 02–04. Record each **moot** item and its reason for the PR description.
2. `git rm -r docs/agents/specs/repos/`.
3. In `docs/agents/specs.md`:
   - set "Active specs" to "none" (unless another feature is active);
   - add a "Completed specs" row: **Repositories** → `modules/repositories.md` (+ `repositories/sync.md`, `repositories/edge-cases.md`), `backend/routes/repositories.md`, `modules/integrations.md`, `modules/integrations/github-app.md`, `modules/auth.md`, `modules/auth/default-user.md`, `backend/routes/auth.md`, `architecture/security.md` (credentials stay in the backend), `architecture/backend.md`, `architecture/infra.md`, `environment-variables.md`, `product.md`, `flow.md`, with product decision #444.
4. **Link sweep:**
   - `grep -rn "specs/repos"` across the repo, excluding `docs/agents/issues/` and `docs/agents/plans/`. Every hit is fixed, including `CLAUDE.md`, `AGENTS.md` and `navi/`.
   - Hits in `backend/` / `frontend/` source comments are repointed to the permanent doc (comment-only edits).
5. **Anchor sweep:** for every touched doc, check that each relative link target exists and each `#anchor` matches a heading slug. This includes inbound links to sections that were renamed or split in `modules/integrations.md` and `modules/auth/default-user.md`.
6. Grep the docs for leftover `Open — settled by` markers.

## Files to Change

- `docs/agents/specs/repos/` — deleted.
- `docs/agents/specs.md` — "Active specs" / "Completed specs".
- Any live doc or source comment found by the sweeps.
