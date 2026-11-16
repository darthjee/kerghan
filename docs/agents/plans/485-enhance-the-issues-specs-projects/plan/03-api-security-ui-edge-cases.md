# Consequence bullets in api, security, ui and edge-cases

Same rules as step 02: one-line decision bullets pointing to `projects.md`, no design of the file's own content, existing open questions kept for their owners.

- `docs/agents/specs/issues/api.md`: behaviors only, never routes or payloads. The shortcut answers `200` for an existing project and `201` for a new one; `409` for a name collision, for a repository that already has a project (explicit path and attach), for a not-added repository on the shortcut, and for change or detach of a repository; a deleted project answers `404` like another user's; a rejected repository reference never reveals whether the row exists. Error codes stay with #489 (keep the "Error codes and shapes" open question).
- `docs/agents/specs/issues/security.md`: the four sharing guardrails (one access check for every project and issue read or write, no scattered `user_id` filters; issues derive access from their project; owner credentials do all GitHub work and the link uniqueness stays per owner; the actor is not assumed to equal the owner). Another user's or a deleted project answers `404`. The description is plain text, never rendered as markup. Required test: the project and its issues go through the single access check and a non-owner gets `404` for both.
- `docs/agents/specs/issues/ui.md`: the deletion confirmation warns that unsent changes will not be written to GitHub and shows how many issues have them; a project shows its repository status (Added, Unavailable, Unknown); creating a project offers an optional repository among the user's added repositories, and the shortcut starts from an added repository. Screens, flows and wording stay with #491.
- `docs/agents/specs/issues/edge-cases.md`: add one pointer line per project edge case (simultaneous creations on one repository or one name, repository with only a deleted project, rename or transfer, Unavailable and return, Unavailable at creation, job or request for a deleted project or user), each pointing to the matching row in `projects.md`. Replace "No matrix rows yet." by a short note that these cases are owned by `projects.md`, keep every existing open question, and note that the cases "A repository removed from the user's repositories" and "An integration or a user deleted" are partly answered there (keep them open for #493).

## Files to Change
- `docs/agents/specs/issues/api.md` — behavior bullets and the 404/409 rules in required tests.
- `docs/agents/specs/issues/security.md` — guardrail bullets and the access-check required test.
- `docs/agents/specs/issues/ui.md` — confirmation and repository-status bullets.
- `docs/agents/specs/issues/edge-cases.md` — pointer lines and the updated purpose note.
