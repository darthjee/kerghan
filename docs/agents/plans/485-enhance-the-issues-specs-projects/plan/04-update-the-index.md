# Update the index

Edit `docs/agents/specs/issues.md` only where a decision here changes what it states:

- **Glossary**: add a note that "project" always means Kerghan's project (an application backed by a repository, or a life/other project) and that the GitHub feature is always written "GitHub Project".
- **Product decisions**: the bullet about the repository becomes "0 or 1 linked repository, at most one project per repository per user (among non-deleted projects)". Add one bullet: deleting a project is a soft delete that frees its name, repository and GitHub links, and never touches GitHub. Keep every other bullet.
- **Index table**: unchanged (the files and their open-questions anchors stay the same). If `projects.md` no longer has an `## Open questions` heading, change that row's link to point to the file itself rather than a missing anchor (or keep the heading with "None." so the anchor still works; pick one in step 01 and use it here).
- **Lifecycle** line: unchanged.

`docs/agents/specs.md` and every other permanent doc stay unchanged.

## Files to Change
- `docs/agents/specs/issues.md` — glossary note, product decisions, index row anchor if needed.
