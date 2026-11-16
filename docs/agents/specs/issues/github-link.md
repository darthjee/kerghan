# Issues and Projects — GitHub link

The optional one-to-one link between a Kerghan issue and a GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

- One to one, per user: unique on user and GitHub issue. Two users may link the same GitHub issue.
- The link is optional.
- It can be created from a GitHub issue, or by attaching one to an existing Kerghan issue.
- The GitHub issue must belong to the project's linked repository; a project with no repository cannot link.
- A project's links are deleted when the project is deleted, which frees their GitHub issues for another project ([projects.md](projects.md#deletion)).
- A project's repository cannot be changed or detached in v1, only attached to a project that has none, so a project that gets a repository later has no links yet ([projects.md](projects.md#changing-a-project-later)). Changing or detaching while no links exist depends on unlinking (#487).

## Open questions

- [ ] How is a link removed (unlinking)? (#487)
- [ ] What happens when the GitHub issue is deleted or transferred? (#487)
- [ ] Which link states exist? (#487)

## Required tests

- Linking a GitHub issue from another repository is refused.
- A project with no repository cannot link.
- Two users may link the same GitHub issue.
- Deleting a project releases its links and frees their GitHub issues.
