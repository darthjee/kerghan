# Issues and Projects — GitHub link

The optional one-to-one link between a Kerghan issue and a GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

- One to one, per user: unique on user and GitHub issue. Two users may link the same GitHub issue.
- The link is optional.
- It can be created from a GitHub issue, or by attaching one to an existing Kerghan issue.
- The GitHub issue must belong to the project's linked repository; a project with no repository cannot link.

## Open questions

- [ ] How is a link removed (unlinking)? (#487)
- [ ] What happens when the GitHub issue is deleted or transferred? (#487)
- [ ] What happens to links when the project's repository changes? (#487)
- [ ] Which link states exist? (#487)

## Required tests

- Linking a GitHub issue from another repository is refused.
- A project with no repository cannot link.
- Two users may link the same GitHub issue.
