# Project management page (`#/projects/:projectId/edit`)

The page has three independent sections. It loads the project the same way as step 06, including "not found".

## 1. Details

- Name and Description, using the same limits as creation.
- **Save** calls `edit.json`. A `200` navigates to `#/projects/:id`, and an unchanged Save still makes the call and returns.
- **Errors.** `PROJECT_NAME_TAKEN` shows on Name. `VALIDATION_FAILED` and `GITHUB_UNAVAILABLE` show at form level.
- **Cancel** goes back without a call, through the U11 guard.

## 2. Repository

**Display.** The current repository (`owner/name` and its status badge), or "No repository".

**Actions.** They act immediately and are separate from Save.

- **"Change" or "Connect a repository"** opens `RepositoryPicker` (step 05). A pick calls `setRepository`.
- **"Detach"** opens `ConfirmModal` (danger, "Detach") and calls `setRepository(null)`.

**Errors** shown in this section:

- `PROJECT_HAS_LINKS` with `meta.linkCount`. The buttons are never pre-disabled.
- `PROJECT_REPOSITORY_TAKEN`, with the link.
- `PROJECT_REPOSITORY_NOT_ADDED`.
- The repository 404.
- `PROJECT_REPOSITORY_CHANGED`.

## 3. Danger zone

**Confirmation.** "Delete project" opens `ConfirmModal`:

- `danger`, with the confirm label "Delete project"
- `typeToConfirm` set to the project name (U9)
- a general warning that issues and GitHub links are deleted and unsent changes are lost, with **no** count

**After the call.**

- A `200` sets the `ProjectNoticeStore` notice (including `unsentIssueCount` when > 0) and navigates to `#/projects`.
- A `404` is treated as done: navigate with "Project deleted."
- Any other error shows inside the modal.

**Spec ids.** Tag the delete specs with E33.

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/edit/` (new): `ProjectEdit.jsx`, a controller per section, and the helpers
- `frontend/specs/assets/js/components/resources/projects/pages/edit/` (new): the project-management cases of `ui.md#required-tests`, U2 and U9
