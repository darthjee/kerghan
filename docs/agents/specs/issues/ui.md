# Issues and Projects — UI

The minimum the interface must offer.
Part of the [Issues and Projects specs](../issues.md).

- The pieces that must exist: a project list, an issue list, and the display of the link state.
- The deletion confirmation warns that unsent changes will not be written to GitHub and shows how many issues have them ([projects.md](projects.md#deletion)).
- A project shows its repository status (Added, Unavailable, Unknown) ([projects.md](projects.md#fields)).
- The link and sync states that must be displayed: "GitHub issue gone" (E1, E2), "rate limited until X" (E17), and sync failed with its reason, a credential reason ("Fix it in Integrations") being distinct (E19 to E21). The user must also be able to unlink a link in any state and to run a manual "retry sync" action (E18). The states follow the precedence of [github-link.md](github-link.md#link-states). Gone offers unlink and no retry sync; sync failed offers retry sync and, for a credential reason, a pointer to Integrations.
- From the [sync spec](sync.md#staleness), inputs for #491: a stale link shows a stale hint and "last synced X ago"; refresh actions exist for one issue and for a project; retry sync turns the state to pending at once.
- Unlinking asks for a plain confirmation when unsent changes exist (E63); attaching asks for one when the local values differ from GitHub's and would be replaced, and the confirmation is bound to the issue's `updated_at`, so an edit made after the warning is shown again with the current differences instead of being replaced (E61). Unlinking an issue that is already unlinked is treated as done (E64).
- Creating a project offers an optional repository among the user's added repositories, and the shortcut starts from an added repository ([projects.md](projects.md#creation-paths)).

## Open questions

- [ ] Screens and navigation. (#491)
- [ ] Creation flows for the explicit and the shortcut paths. (#491)
- [ ] Exact wording and placement of the link and sync states and of the retry sync action. (#491)
- [ ] Empty and error states. (#491)

## Required tests

Frontend tier ([testing.md](testing.md#frontend-tests)):

- The project list, the issue list and the link and sync state views exist: "GitHub issue gone" (E1, E2), "rate limited until X" (E17), sync failed with a distinct credential reason (E19 to E21).
- The retry sync action (E18) and the unlink action are offered where the states call for them: gone offers unlink and no retry sync.
- The link states display in the precedence order of [github-link.md](github-link.md#link-states).
- The unlink action asks for the unsent-changes confirmation (E63) and the attach action for the replace confirmation bound to `updated_at` (E61).
- The deletion confirmation shows the count of issues with unsent changes.
- A project description renders as text, never as markup `(static)`.

Screens and wording are #491's.
