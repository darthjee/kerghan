# Security static spec, docs and spec note

- Extend `securityStaticSpec.js` to `IssuesBulkBarHelper.jsx` and `BulkSelectionController.js`: no `dangerouslySetInnerHTML` or `innerHTML`, and no storage writes.
- Update `docs/agents/architecture/frontend.md`: the "Open issues" column, the bulk bar and its controller (the selection rules, the single re-read, the countdown).
- Record the placement of the count in `docs/agents/specs/issues/ui/states.md#scope` (the spec gave only the wording): "shown in an 'Open issues' column after Repository".

## Files to Change

- `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js`: cover the new files
- `docs/agents/architecture/frontend.md`: the count and the bulk bar
- `docs/agents/specs/issues/ui/states.md`: the column placement
