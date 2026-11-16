# Rewrite model.md

Rewrite `docs/agents/specs/issues/model.md` from the issue body (section "Solution"), keeping its header lines (title, "Part of the Issues and Projects specs"). Sections, in this order:

1. **Overview and module layout**: one `issues` module owning four tables (`issues_projects`, `issues`, `issues_github_links`, `issues_pending_writes`), conventions (`int` auto-increment `id`, plain `int user_id`, explicit `varchar` lengths, `datetime` from the injected `Clock`, `idx_<table>_<cols>` names, all FKs logical, repository summary read through Repositories' exported service). Keep the existing statements still true (ownership by user, supersedes `product.md`'s "not persisted by default", deletion marker).
2. **One section per table** with a column table (type and notes): `issues_projects` (including `deleted_at`, `deleted_token`, the uniqueness mechanism and the accent- and case-insensitive collation note), `issues` (no `user_id`, title 256, body `mediumtext` capped at 65536 characters, state, no number, labels not in v1), `issues_github_links` (including the base snapshot, `status` reserved for #487 and #488, key `github_issue_id` plus `github_number`, issues only), `issues_pending_writes` (coalesced marker, revision, compare-and-clear, boot re-enqueue, attempts in memory).
3. **Indexes**: the six-index table, the `deleted_token = 0` live predicate and the "not added on purpose" notes.
4. **Cleanup**: lock order, `user.deleted` listener, no `integration.deleted` hook, project and issue deletion, repository removal rule and the read-only check (mechanism not decided).
5. **Persistence statement and fold list**: the narrow carve-out and the table of statements to rewrite (`product.md`, `AGENTS.md`, `CLAUDE.md`, `architecture/security.md`, `summary.md`, `flow.md`), with the "ask before touching root files" note.
6. **Alternatives considered** (table), **Edge cases** (the 16-row table), **Scope boundaries**, **Backward compatibility**, **Performance and security** (short bullets).
7. **Open questions**: only the four that remain, each with its reason and owner (retention of soft-deleted project content #490; encryption of issue content and quotas #490; the repository-removal mechanism, not decided; link states and unlinking #487, synced fields and conflict rules #488, column reservations only). Tick or remove the five questions of the current file.
8. **Required tests**: the three constraints, uniqueness among non-deleted projects with `deleted_at` and `deleted_token` written together, compare-and-clear, boot re-enqueue, cleanup contracts and lock order, utf8mb4 and `bigint` round-trips, migration up and down, two-user baseline, and one test per edge-case row.

Keep each section short; prefer tables for columns, indexes and edge cases.

## Files to Change

- `docs/agents/specs/issues/model.md` — full rewrite as described.
