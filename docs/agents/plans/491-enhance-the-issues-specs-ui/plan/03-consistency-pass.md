# Consistency pass

Re-read the changed files together and check:

- No remaining "#491's" deferral or unchecked #491 open question in `docs/agents/specs/` (`grep -rn "#491" docs/agents/specs`).
- No file still says the deletion confirmation shows the unsent count.
- Every relative link and anchor added to `ui.md` and from the other files resolves (`grep -o "](\([^)]*\))"` and check the target headings).
- Error codes, `meta` fields, link states and reasons in `ui.md` match `api.md`'s catalogue and link object exactly.
- The "Required tests" of `ui.md` cover every rule in the file, and `testing.md`'s Frontend paragraph agrees with it.
- No code, migration, endpoint or dependency was added; `architecture/frontend.md` is untouched.

## Files to Change

- Any of the files from Steps 01 and 02 that the checks show need a fix.
