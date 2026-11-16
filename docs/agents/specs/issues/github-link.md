# Issues and Projects — GitHub link

The optional one-to-one link between a Kerghan issue and a GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

- One to one, per user: unique on user and GitHub issue. Two users may link the same GitHub issue.
- The link is optional.
- It can be created from a GitHub issue, or by attaching one to an existing Kerghan issue.
- The GitHub issue must belong to the project's linked repository; a project with no repository cannot link.
- A project's links are deleted when the project is deleted, which frees their GitHub issues for another project ([projects.md](projects.md#deletion)).
- A project's repository cannot be changed or detached in v1, only attached to a project that has none, so a project that gets a repository later has no links yet ([projects.md](projects.md#changing-a-project-later)). Changing or detaching while no links exist depends on unlinking (#487).
- A GitHub issue deleted or transferred puts the link in a "gone" state: the Kerghan issue is never deleted or closed, the marker is discarded, nothing is auto-unlinked and no GitHub call is made for that link; a `404` counts as gone only when the repository is still readable with the same credential (E1, E2, E22). Kerghan never follows a transfer. Pull requests are refused on attach and skipped on import (E3).
- Stored in `issues_github_links`: unique on (`user_id`, `github_issue_id`) and on `issue_id`; keyed by GitHub's global issue id plus its number; issues only (pull requests are #487's rule); a base snapshot of title, body and state ([model.md](model.md#issues_github_links)).

## Open questions

- [ ] How is a link removed (unlinking)? (#487)
- [ ] State names, and what GitHub actually answers for a deleted or transferred issue (the outcome is fixed in [edge-cases.md](edge-cases.md), E1 to E3 and E22). (#487)
- [ ] Which link states exist? (#487)

## Required tests

Default tier: unit on the sync service with the fake GitHub client; the attach and unlink answers are e2e ([testing.md](testing.md#fixtures)).

The unique indexes and link cleanup are tested in [model.md](model.md#required-tests).

- Linking a GitHub issue from another repository is refused.
- A project with no repository cannot link.
- Two users may link the same GitHub issue.
- Deleting a project releases its links and frees their GitHub issues.
- A deleted or transferred GitHub issue (E1, E2), a `404` with an unreadable repository (E22) and a pull request (E3) behave as in [edge-cases.md](edge-cases.md).
