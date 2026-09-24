# Plan: Refactor: Fix markdownlint findings in docs and the commit message template

Issue: [239-refactor-fix-markdownlint-findings-in-docs-and-the-commit-message-template.md](../../issues/239-refactor-fix-markdownlint-findings-in-docs-and-the-commit-message-template.md)

## Overview

Clear Codacy's 5 markdownlint Info findings. Add the missing blank lines before two lists in the
docs (MD032). For the commit message templates (MD033), add a markdownlint-only exclusion in
`.codacy.yml`, because their `<...>` placeholders are intentional template syntax in
arcanum-managed files that must not be edited.

## Context

- `docs/agents/architecture.md:10` and `docs/agents/backend/routes/auth.md:156` each start a list
  on the line right after a paragraph, with no blank line between them.
- `.github/commit_message_template.md` and `.github/commit_message_template-2.0.md` are installed
  by arcanum's `init-claude` and used by the arcanum commit scripts. They are not git's
  `commit.template`. Arcanum's own `.markdownlintignore` already excludes both. Only the first
  one was reported, but the `-2.0` sibling has the same placeholders, so both are excluded.
- `.codacy.yml` already follows a set pattern: narrow, per-engine `exclude_paths`, listed file
  by file (a glob only when every match is safe to exclude), each with a comment explaining why
  and naming the issue. There is no `markdownlint` block yet.

## Implementation Steps

### Step 1 — Add blank lines before the flagged lists

- `docs/agents/architecture.md`: insert an empty line between "This page is the hub. See the area
  pages for details:" and the `- [Proxy](...)` list item.
- `docs/agents/backend/routes/auth.md`: insert an empty line between the paragraph ending "It is
  set with:" and the `- \`httpOnly: true\`` list item.

Change nothing else in these files. The rendered output stays the same.

### Step 2 — Exclude the commit templates from Codacy's markdownlint

Append a new `markdownlint:` engine block under `engines:` in `.codacy.yml` (after `lizard:`):

```yaml
  markdownlint:
    exclude_paths:
      # The commit message templates are arcanum-managed (installed by `init-claude`, consumed
      # by the arcanum commit scripts). Their `<type>`, `<scope>`, `<agent>`... placeholders
      # are template syntax, not inline HTML, so MD033 is a false positive. Escaping them would
      # drift from the upstream copies — arcanum's own `.markdownlintignore` excludes the same
      # two files. Excluded for markdownlint only, file by file. See issue #239.
      - '.github/commit_message_template.md'
      - '.github/commit_message_template-2.0.md'
```

Do not touch either template file, and do not use the top-level `exclude_paths`.

## Files to Change

- `docs/agents/architecture.md` — blank line before the area-pages list (MD032).
- `docs/agents/backend/routes/auth.md` — blank line before the cookie-attributes list (MD032).
- `.codacy.yml` — new `engines.markdownlint.exclude_paths` block for the two commit templates (MD033).

## Notes

- CI has no markdownlint job (`.circleci/config.yml`), so the only real check is Codacy's
  re-analysis of `main` after merge.
- Make sure `.codacy.yml` is still valid YAML (two-space indentation, matching the sibling
  engine blocks).
