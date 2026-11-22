# Edge-case coverage

Every row of `docs/agents/specs/issues/edge-cases.md` must be covered by some spec, on the tier its "Tier" list gives.

1. **Cite existing coverage:** add the E-id to the `describe` or `it` title of the tests that already cover E6, E31, E33, E40, E48, E55 and E61. Candidates include `user-deleted.listener.db-spec.ts`, `projects.service.delete.db-spec.ts` and `issue-links.attach.db-spec.ts`. Check each against its row before tagging it.
2. **Add the missing tests:**
   - E5: a `403` on a push to an archived or read-only repository follows E19, and reads still work. Use a unit or the sync DB spec.
   - E9: an inbound refresh while a marker exists keeps a field with an unsent edit (`issue-sync-merge.spec.ts` and `issues-sync.service.db-spec.ts`).
   - E23 and E30: after the last integration is deleted, the next job follows E20, and the project still reads normally (`(db)`).
   - E27: a repository that becomes Unavailable discards nothing, and its linked issues are not marked gone without a passing probe.
   - E28: a repository turning private or public changes nothing in Kerghan, and reads stay owner-only.
   - E38: sync is refused while the repository is Unavailable and resumes when it returns, and the project is untouched.
   - E43: an edit that reverts to the base values clears the pending marker or sends nothing, as `sync.md` decides (`(db)`).
   - E49: soft-deleting an already-deleted project answers like a missing one and changes nothing (`(db)`).
3. **Coverage check:** add `edge-cases.coverage.spec.ts` (static). It parses the E-ids from `edge-cases.md` and fails if any id is not cited in some spec under `backend/src/` or `frontend/`, except an explicit, commented allowlist: E25 (the future removal feature) and E66 to E74 (#563). Frontend-tier rows that #560 to #562 will cover also go on the allowlist, each with its issue number, so those issues remove them.

## Files to Change
- The existing specs listed in point 1: title tags only.
- `backend/src/issues/tests/issue-sync-merge.spec.ts`, `issues-sync.service.db-spec.ts`, `projects.service.delete.db-spec.ts` and `issues-sync.triggers.db-spec.ts` (or new focused specs): the missing tests of point 2.
- `backend/src/issues/tests/edge-cases.coverage.spec.ts`: new.
