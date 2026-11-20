# Point the specs at the new issues

The specs name #492 as "the implementation" or "at fold time". Now that the real issues exist, point each reference at the issue that owns it. Use the mapping file. Change only the reference, never a decision.

- `docs/agents/specs/issues.md`:
  - Scope, "Out of scope now": "implementation (spawned by #492)" becomes "implementation (the sub-issues of #483 spawned by #492, listed under Implementation issues below)".
  - Lifecycle: after "then #492 …", add a short **Implementation issues** list: rows 1 to 12 with their numbers, one line each, with the spec files and the issues they wait for. Row 11 waits for #507, and row 12 (the fold) comes last.
- `docs/agents/specs/issues/model.md`, lines 119, 132 and 177: "At fold time (#492)", "#492 proposes the edit…", "#492 also copies…" → the fold issue (row 12). "code and migrations (spawned by #492)" → row 1.
- `docs/agents/specs/issues/projects.md:46`: "#492 is told to copy that rule" → the fold issue (row 12).
- `docs/agents/specs/issues/security.md:190`: "the implementation spawned by #492" → "the implementation issues spawned by #492 (rows 1 to 11; the final check is row 7)". Use the real numbers.
- `docs/agents/specs/issues/api.md:5`: "built by the implementation issue (#492)" → rows 3 to 6 (and 11 for #507's additions).
- `docs/agents/specs/issues/ui.md:5`, `docs/agents/specs/issues/ui/decisions.md:28`, `docs/agents/specs/issues/ui/states.md:48`: "#492" as the implementation → rows 8 to 10 (and 11 for the #507 parts).

Run `grep -rn "#492" docs/ .claude/` afterwards. The only references left must be the ones that mean "the issue that spawned the implementation" (for example in the Lifecycle line of `issues.md`), plus this issue's own issue and plan files.

Keep the docs style rules of the repo (`docs/agents/contributing.md`, if it states any, for example line or file length limits). The specs stay under their limits: the list in `issues.md` adds about 15 lines.

## Files to Change

- `docs/agents/specs/issues.md`: scope wording and the new "Implementation issues" list.
- `docs/agents/specs/issues/model.md`: fold and implementation references.
- `docs/agents/specs/issues/projects.md`: fold reference.
- `docs/agents/specs/issues/security.md`: review reference.
- `docs/agents/specs/issues/api.md`: implementation reference.
- `docs/agents/specs/issues/ui.md`, `docs/agents/specs/issues/ui/decisions.md`, `docs/agents/specs/issues/ui/states.md`: implementation references.
