# Issues and Projects — Data model

The entities and their relations.
Part of the [Issues and Projects specs](../issues.md).

- Entities: project, issue, GitHub link, pending marker (the durable record of an outbound write not yet done).
- Relations: an issue belongs to one project; a project belongs to one user; a link belongs to one issue.
- Ownership is by user.
- The link is unique on user and GitHub issue, and a Kerghan issue holds at most one link.
- This feature persists issue data, which supersedes `product.md`'s "not persisted by default" statement (see the [index](../issues.md)).

## Open questions

- [ ] Columns, types and lengths of each entity. (#486)
- [ ] Indexes beyond the known unique constraint. (#486)
- [ ] Which GitHub data is stored on the link or the issue. (#486)
- [ ] Cleanup hooks when a user, repository or integration is deleted. (#486)
- [ ] How the `product.md` persistence statement is rewritten at fold time. (#486)

## Required tests

- The unique constraint on the link (user and GitHub issue) is enforced.
- A Kerghan issue holds at most one link.
