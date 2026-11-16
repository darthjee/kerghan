# Write edge-cases.md

Rewrite `docs/agents/specs/issues/edge-cases.md` from the issue's decided content.

- Header: purpose, link to the specs index, and the rule that the matrix is an index (a change of outcome is made in the owning file first, then reflected here).
- Table columns: `#` | Case | Expected behavior | Rule (owning file, linked) | Check (required test) | Status (`Decided` or `Contract`). Stable ids `E1…En`.
- Seven groups in order: projects; GitHub issue and link; edits and conflicts; jobs, restart and rate limits; credentials and integrations; repository; users and cleanup.
- Full rows for E1 to E3, E5 to E13, E15 to E22, E24, E27, E28 as in the issue; index one-liners for E4, E14, E23, E25, E26, E29 to E33, plus the 7 project rows (`projects.md#edge-cases`) and the 16 data rows (`model.md#edge-cases`), with ids continuing after E33.
- Record the E7 limitation (timestamps are per issue, not per field; GitHub keeps edit history of titles and bodies, Kerghan none).
- `## Open questions`: the four items of the issue, each with its owner issue (the per-field timestamps item has none yet), as `- [ ]`.
- `## Required tests`: one test per row citing its id; rows already tested in `projects.md` or `model.md` point there.

## Files to Change
- `docs/agents/specs/issues/edge-cases.md` — the matrix, open questions and required tests.
