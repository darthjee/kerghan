# Creation flows (explicit form and shortcut)

## Explicit form (`#/projects/new`)

**Fields.**

- **Name:** required, 1 to 100 trimmed code points.
- **Description:** up to 2000.
- **Repository:** optional. The default is "No repository".

The limits go through `utils/validation`.

**`RepositoryPicker`.** A reusable component, also used by step 07.

- It searches over `RepositoriesClient.list({ filter: 'added', search, perPage: 20 })`, debounced and ignoring out-of-order answers.
- Picking a result shows `owner/name` with a Clear button.
- **Hint.** When the unsearched `filter: 'added'` call returns `pagination.total === 0`, the picker shows "Add a repository first" linking to `#/repositories`.

**Prefill.** The form reads `?repository=<githubId>&repositoryName=<owner/name>&name=<name>` from the hash query. `repositoryName` is used for display only.

**Submit.**

- The body is `{ name, description, repository: { githubId } | null }`.
- A `201` navigates to `#/projects/:id`.
- The button is disabled in flight (U2).

**Field errors.**

- **Repository:** `PROJECT_REPOSITORY_TAKEN` (with the link to `meta.projectId`), `PROJECT_REPOSITORY_NOT_ADDED` and the repository 404.
- **Name:** `PROJECT_NAME_TAKEN`.

**Form-level errors.** `PROJECTS_LIMIT_REACHED`, `VALIDATION_FAILED` (its `details`) and `GITHUB_UNAVAILABLE`. The form keeps the typed values.

**Dirty-form guard.** Cancel goes back, through the U11 guard from step 02.

## Shortcut (Repositories page)

**Button.** Add a "Project" button on rows whose status is Added, in `RepositoriesTableHelper.jsx`, with its own in-flight and error store in the style of `AddStateStore`.

**Behaviour.**

- **Call.** It calls `ProjectsClient.createFromRepository({ githubId })`.
- **`201` or `200`.** Both navigate to `#/projects/:id`.
- **`PROJECT_NAME_TAKEN`.** Navigate to `#/projects/new?repository=…&repositoryName=…&name=<owner/name>`. The form then shows the name-taken error on Name: carry it through a query flag such as `&error=name_taken`, or through an in-memory store.
- **Other refusals.** They show inline under the button.
- **In flight.** A spinner, and the button disabled.

**Repositories table specs.** Add the button case to them. Add, filter and refresh stay unchanged.

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/new/` (new): `ProjectNew.jsx`, controller and helper
- `frontend/assets/js/components/resources/projects/repositoryPicker/` (new): controller and helper
- `frontend/assets/js/components/resources/repositories/pages/helpers/RepositoriesTableHelper.jsx`: the Project button
- `frontend/assets/js/components/resources/repositories/pages/repositories/ProjectShortcutStore.js` (new), plus its wiring in `RepositoriesController.js` and `RepositoriesHandlers.js`
- `frontend/specs/assets/js/components/resources/projects/pages/new/`, `frontend/specs/assets/js/components/resources/projects/repositoryPicker/` and the Repositories table, controller and harness specs: all the cases in the creation part of `ui.md#required-tests`
