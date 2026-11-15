# Write the index issues.md

Create `docs/agents/specs/issues.md` (this also creates `docs/agents/specs/`). Contents:

- **Overview and purpose:** the feature, as in epic #483, and that these specs are the source of truth while they exist.
- **Glossary:** project, issue (Kerghan issue), GitHub issue, link.
- **Scope:** in and out, taken from the epic (specs now; implementation later, spawned by #492; sharing, members and roles out of scope).
- **Product decisions:** the decisions already made in the epic, as a list (project home of issues; 0 or 1 repository; one private owner; the two creation paths; the one-to-one per-user link; two-way sync; the worker rules).
- **Name collision note:** `docs/agents/specs/issues/` is the spec folder and is unrelated to `docs/agents/issues/` (issue drafts).
- **Supersedes `product.md`:** until the specs are folded in, they supersede `product.md`'s statement that issue data is not persisted by default.
- **Index:** a link to each of the nine files, each with a link to its `## Open questions` section anchor (`#open-questions`) where it has one.
- **Lifecycle pointer:** a link back to `specs.md`, and the epic's order of work (#484, #485 to #491, #493, #494, then #492).

The index has no Required tests section and does not copy the open questions.

## Files to Change
- `docs/agents/specs/issues.md` — new index.
