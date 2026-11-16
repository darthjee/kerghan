# Align edge-cases.md

Make the matrix point at the strategy and give each row a tier.

- Replace "fixtures owned by #494" in its "Required tests" section with a link to [testing.md](../../../specs/issues/testing.md) (fixtures section).
- Add a tier to each of E1 to E56 (by category default, or a tag where it differs), either as a column in the tables or as a mapping list in "Required tests", whichever keeps the tables readable. Race rows (E15, E32, E41, E44) and DB parallelism rows (E34, E35, E42, E46, E48, E49) use the tags of testing.md.
- Resolve the "(fixtures owned by #494)" wording in the open questions if present.

## Files to Change

- `docs/agents/specs/issues/edge-cases.md` — link to testing.md, add the tier mapping.
