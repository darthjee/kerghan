# Issue: Refactor: Fix markdownlint findings in docs and the commit message template

## Description
Two docs and the commit message template have small markdownlint findings reported by Codacy.

## Problem
5 Info findings:

- `docs/agents/architecture.md:10` — MD032, list needs surrounding blank lines
- `docs/agents/backend/routes/auth.md:156` — MD032, same
- `.github/commit_message_template.md:1,5,6` — MD033, inline HTML elements (`<type>`, `<AI>`, `<agent>` placeholders)

The commit message templates (`.github/commit_message_template.md` and its sibling `.github/commit_message_template-2.0.md`) are arcanum-managed files. `init-claude` installs them and the arcanum commit scripts use them. They are not set as git's `commit.template`, and arcanum's own `.markdownlintignore` already excludes both. Their `<...>` placeholders are intentional template syntax, not HTML.

## Expected Behavior
- The two docs render the same, with a blank line before each flagged list.
- The commit message templates stay unchanged, so they match the arcanum upstream copies.
- Codacy's markdownlint no longer reports any of the 5 findings.

## Solution
1. `docs/agents/architecture.md`: add a blank line between "This page is the hub. See the area pages for details:" and the list that follows (line 10).
2. `docs/agents/backend/routes/auth.md`: add a blank line between "It is set with:" and the list that follows (line 156).
3. `.codacy.yml`: add a new `engines.markdownlint.exclude_paths` block listing, file by file (no glob):
   - `.github/commit_message_template.md`
   - `.github/commit_message_template-2.0.md` (not in the reported findings, but it has the same placeholders and the same ownership, so this heads off the identical finding)

   Add a comment in the file's existing style. It should say that these are arcanum-managed commit templates whose `<...>` placeholders are template syntax, not inline HTML. It should also say that editing or escaping them would drift from upstream (arcanum's own `.markdownlintignore` excludes them the same way), and reference issue #239. Scope the exclusion to markdownlint only, never the top-level `exclude_paths`.

Do not edit either template file.

## Benefits
Removes the 5 Info findings (and pre-empts the matching one on the `-2.0` template) without changing the commit templates.

## Verification

- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
