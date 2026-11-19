# Align the specs that defer to #491

Replace every "#491's" deferral with a pointer to the matching section of `ui.md`, and mark the related open questions as decided (`- [x] … decided in [ui.md](ui.md#…) (#491)`).

- `api.md`: the overview line (wording, screens and polling cadence), the link-object notes on re-reading after a trigger and on wording and placement, the error-catalogue note on UI wording, and the open-questions line.
- `sync.md`: the trigger wording line, the stale wording in Staleness, and its open question.
- `github-link.md`: the overview line, the precedence line, and its open question.
- `security.md`: the "UI points to Integrations (#491)" line and the open-questions note.
- `testing.md`: the Frontend paragraph. Drop "with its count of issues with unsent changes" from the deletion confirmation (the count is shown after the delete), add the new required areas (routes, linking modals, bounded re-reads, `ConfirmModal`, U rows) and replace "Screens and wording are #491's" with a pointer to `ui.md`'s Required tests. Close its open question.
- `edge-cases.md`: the "Wording and placement stay with #491" note becomes decided, pointing to `ui.md`; mention that UI-only cases are the U rows of `ui.md`.
- `projects.md`, `model.md`: the "UI with #491" pointers become links to `ui.md`.
- `docs/agents/specs/issues.md`: the status table row for `ui.md` changes from open to decided.

## Files to Change

- `docs/agents/specs/issues/api.md` — deferrals to #491 become pointers to `ui.md`.
- `docs/agents/specs/issues/sync.md` — the same, and close its #491 open question.
- `docs/agents/specs/issues/github-link.md` — the same, and close its #491 open question.
- `docs/agents/specs/issues/security.md` — pointers to `ui.md`.
- `docs/agents/specs/issues/testing.md` — Frontend paragraph updated, delete-count wording corrected, open question closed.
- `docs/agents/specs/issues/edge-cases.md` — the #491 note becomes decided.
- `docs/agents/specs/issues/projects.md` — pointer to `ui.md`.
- `docs/agents/specs/issues/model.md` — pointer to `ui.md`.
- `docs/agents/specs/issues.md` — status of `ui.md`.
