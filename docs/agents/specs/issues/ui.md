# Issues and Projects — UI

The minimum the interface must offer.
Part of the [Issues and Projects specs](../issues.md).

- The pieces that must exist: a project list, an issue list, and the display of the link state.
- The deletion confirmation warns that unsent changes will not be written to GitHub and shows how many issues have them ([projects.md](projects.md#deletion)).
- A project shows its repository status (Added, Unavailable, Unknown) ([projects.md](projects.md#fields)).
- Creating a project offers an optional repository among the user's added repositories, and the shortcut starts from an added repository ([projects.md](projects.md#creation-paths)).

## Open questions

- [ ] Screens and navigation. (#491)
- [ ] Creation flows for the explicit and the shortcut paths. (#491)
- [ ] How link and sync states are displayed. (#491)
- [ ] Empty and error states. (#491)

## Required tests

None yet beyond the existence of the project list, the issue list and the link state views.
