# Point the edge-case coverage spec at the new page

`backend/src/issues/tests/edge-cases.coverage.spec.ts` reads the edge-case matrix from `docs/agents/specs/issues/edge-cases.md` (line 13). Change `EDGE_CASES` to `path.join(REPOSITORY_ROOT, 'docs', 'agents', 'modules', 'issues', 'edge-cases.md')`. Update the header comment (lines 4 and 5) to cite `docs/agents/modules/issues/testing.md` and `modules/issues/edge-cases.md`. Keep the row regex, the allowlist (E25) and the skip-when-not-mounted behavior unchanged.

The architect writes the new page (architect step 01). Run the spec once that file exists, and check that it finds the same set of ids as before, with no id lost.

## Files to Change

- `backend/src/issues/tests/edge-cases.coverage.spec.ts`: the `EDGE_CASES` path and the header comment.
