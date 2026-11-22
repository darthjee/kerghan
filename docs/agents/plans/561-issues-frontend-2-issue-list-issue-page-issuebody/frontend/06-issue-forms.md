# Issue create and edit forms
Add `IssueNew.jsx` (`…/issues/new`) and `IssueEdit.jsx` (`…/issues/:issueId/edit`), which share `IssueFieldsHelper.jsx`.

- **Load.** The new form loads the project, through `ProjectLoadController`, for the not-found view and the Back link. The edit form loads both through `IssueLoadController` from step 05 and starts from the issue's values.
- **Fields:**
  - Title, validated client-side through `issueValidators` before any call
  - Body, with Write and Preview tabs (react-bootstrap `Tabs` or `Nav`). Write is a plain textarea that is never trimmed. Preview mounts `IssueBody` **only** while its tab is selected (P3).
  - State select (Open, Closed), on the edit form only
- **Notes on the edit form.** When the issue is linked and `link.state !== 'gone'`, show "Changes are sent to GitHub issue #N". When the link is `gone`, show "The GitHub issue is gone; changes stay in Kerghan."
- **Submit:**
  - Create calls `IssuesClient.create(projectId, { title, body })` and navigates to `ProjectPaths.issue(projectId, created.id)`.
  - Save calls `IssuesClient.edit(projectId, issueId, { title, body, state })` and navigates to the issue page.
  - Cancel goes back without a call.
  - Submit is disabled in flight (U2).
- **Errors.** They are form-level and keep the typed values:
  - `ISSUES_LIMIT_REACHED`
  - `ISSUE_EDIT_RATE_LIMITED`, where Save stays disabled and reads "Try again in N s" from the shared countdown until it elapses, with no resubmit
  - `VALIDATION_FAILED`, with its `details` listed

  A `404` shows the matching not-found view.
- **U11.** Wire `useDirtyFormGuard` and `DirtyFormPrompt` as the project forms do. Dirty means the title, body or state differs from the starting values. Cancel and in-app navigation ask "Discard unsaved changes?", and `beforeunload` prompts. A successful submit leaves without asking (`forceLeave`).
- **S4.** No draft is written to storage.

Specs:

- the limits, including body 65536 and not trimmed, and title 256 after trimming
- Preview not mounted until selected
- the linked and gone notes
- create and save navigation
- Cancel with no call
- each form-level error keeping the values
- the countdown on Save with a fake clock
- U11 (clean leaves silently; dirty asks; the hash is restored)

## Files to Change
- `frontend/assets/js/components/resources/issues/pages/IssueNew.jsx` — new
- `frontend/assets/js/components/resources/issues/pages/IssueEdit.jsx` — new
- `frontend/assets/js/components/resources/issues/pages/form/IssueFormController.js` — new, create and edit submit, errors, countdown
- `frontend/assets/js/components/resources/issues/pages/form/IssueFieldsHelper.jsx` — new
- `frontend/specs/assets/js/components/resources/issues/pages/form/` — the specs
