# Create edge-cases.md

Create `docs/agents/specs/repos/edge-cases.md`, the edge-case matrix, after steps 02–04 so that
every link resolves.

- **Header:** "# Repositories — Edge cases", with one line: "Part of the [Repositories
  specs](README.md)". The matrix is an index: each row states the outcome and links to the rule
  that defines it.
- **One `##` section per area, in this order:**
  - Sync sources: renames and transfers, several sources, failure vs disappearance, page cap,
    rate limit, `304`;
  - Integrations;
  - Handle;
  - Visibility;
  - Concurrency;
  - Add;
  - User deletion;
  - UI.
- **Columns:** `Case | Stored state | Row status | Source status | UI | Rule`. Use `—` where a
  column does not apply.
- **Rows:** take them from the issue's Solution subsections. Each Rule cell links to the owning
  file's anchor, either the existing rule or the new one from steps 02–04.
- **`## Required tests`:** only the cross-module scenario tests from the issue:
  - an integration deleted mid-sync;
  - delete and re-create the same credential;
  - user deleted during a sync;
  - an added public repo with no link turning private (two variants);
  - credential replaced during a sync.

## Files to Change

- `docs/agents/specs/repos/edge-cases.md` — new file.
