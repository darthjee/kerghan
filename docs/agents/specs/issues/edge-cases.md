# Issues and Projects — Edge cases

Purpose: a matrix of edge cases across projects, issues, the link and the sync, each row giving the expected behavior, the owning file and the verifying check. The project cases are owned by `projects.md`; the other rows do not exist yet.
Part of the [Issues and Projects specs](../issues.md).

The project cases are owned by [projects.md](projects.md#edge-cases); this file points to them.

- Two simultaneous creations on one repository or on one name: [projects.md](projects.md#edge-cases).
- Create or attach on a repository that has only a deleted project: [projects.md](projects.md#edge-cases).
- Repository renamed or transferred on GitHub: [projects.md](projects.md#edge-cases).
- Repository Unavailable and returning, or Unavailable at creation: [projects.md](projects.md#edge-cases).
- Job or request for a deleted project or user: [projects.md](projects.md#edge-cases).

"A repository removed from the user's repositories" and "An integration or a user deleted" are partly answered in [projects.md](projects.md#linked-repository-unavailable-or-removed) and stay open for #493.

## Open questions

- [ ] A GitHub issue deleted or transferred. (#493)
- [ ] A repository removed from the user's repositories. (#493)
- [ ] An integration or a user deleted. (#493)
- [ ] Concurrent edits on both sides. (#493)
- [ ] A revoked credential with a pending write. (#493)
- [ ] A restart with pending writes. (#493)
- [ ] Rate limits and duplicate jobs. (#493)

## Required tests

None yet.
