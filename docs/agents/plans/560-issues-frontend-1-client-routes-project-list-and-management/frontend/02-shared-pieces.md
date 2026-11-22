# Shared pieces: ids, error map, ConfirmModal, dirty-form prompt

**Uuid guard.** Add `utils/ids/uuid.js` with `isUuid(value)`. The client (step 01) and the pages (S3) use it: a non-uuid id shows "not found" without making a call.

**Error map.** Add the issues error map in a new `components/resources/projects/errors/errorMessages.js`. The map goes from code to renderer and defaults to `ApiError.message`. It holds:

- `PROJECT_REPOSITORY_TAKEN`: a link to `#/projects/<meta.projectId>`, but only when the id is a uuid
- `PROJECT_HAS_LINKS`: "N linked issues use this repository; unlink them before changing it", built from `meta.linkCount`
- `PROJECT_REPOSITORY_CHANGED`
- `GITHUB_UNAVAILABLE`
- `VALIDATION_FAILED`: the `details` listed

It also exposes the field-target mapping that the forms use, for `PROJECT_NAME_TAKEN` (Name), and for `PROJECT_REPOSITORY_NOT_ADDED` and the repository 404 (Repository). #561 and #562 add the rate-limit and link codes.

**`ConfirmModal`.** A react-bootstrap `Modal` in `components/common/confirmModal/`, split as Controller and Helper like `loginModal`. Its props:

- `title`, `message`, `confirmLabel`, `danger`
- `typeToConfirm`: an optional text
- `onConfirm`: returns a promise
- `onCancel`

Its behaviour:

- **Focus:** Cancel gets the initial focus, so Enter never confirms a destructive action.
- **Confirm button:** on the right, `btn-danger` when `danger` is set.
- **Typed text (U9):** when `typeToConfirm` is set, the confirm button is enabled only when the typed value, trimmed, equals the text exactly (case-sensitive).
- **In flight:** a spinner, and both buttons disabled.
- **Errors:** a rejected `onConfirm` shows its message inside the modal.

**Dirty-form prompt (U11).** Add a `useDirtyFormGuard(isDirty)` hook (or a controller class, following the repo's hook and controller conventions).

- **Leaving in the app.** When the form is dirty, Cancel, an in-app link or a `hashchange` away from the form restores the previous hash and then opens `ConfirmModal` with "Discard unsaved changes?". Confirming navigates on.
- **Close or reload.** The hook registers `beforeunload` while the form is dirty.
- **Clean form.** It leaves silently.
- **S4.** Nothing is written to `localStorage` or `sessionStorage`.

Use `specs/support/fakeWindow.js` to drive the hash and `beforeunload`.

## Files to Change
- `frontend/assets/js/utils/ids/uuid.js` (new) and its spec
- `frontend/assets/js/components/resources/projects/errors/errorMessages.js` (new) and its spec
- `frontend/assets/js/components/common/confirmModal/` (new): `ConfirmModal.jsx`, controller and helper
- `frontend/specs/assets/js/components/common/confirmModal/` (new): focus, button order and label, typed confirmation, in-flight state, error inside the modal
- `frontend/assets/js/components/common/forms/` (or `utils/`): the dirty-form guard (new) and its spec, covering U11 and S4
