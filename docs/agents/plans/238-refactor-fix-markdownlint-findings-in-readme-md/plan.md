# Plan: Refactor: Fix markdownlint findings in README.md

Issue: [238-refactor-fix-markdownlint-findings-in-readme-md.md](../../issues/238-refactor-fix-markdownlint-findings-in-readme-md.md)

## Overview
Documentation-only edit to the root `README.md` that resolves exactly the 11 markdownlint findings
Codacy reported (MD022, MD036, MD032, MD034). No code, config, or other files change.

## Context
Codacy's analysis of `main` flags 11 Info findings in `README.md`. The issue is deliberately scoped
to those 11 only — other markdownlint issues in the file that Codacy did not report (the unlabeled
code fence at `:57`, the fences inside list items at `:78`/`:84`) must be left untouched.
`README.md` is a root-level file, so it falls under the architect's scope rather than any specialist
agent's.

## Implementation Steps

### Step 1 — Fix the title spacing and tech-stack pseudo-headings
- **MD022 (`:1`)**: insert a blank line between `# kerghan` and the tagline
  `A tool for monitoring github issues`.
- **MD036 (`:35`, `:43`, `:50`)**: replace `**Backend**`, `**Frontend**` and `**Infrastructure**`
  with `### Backend`, `### Frontend` and `### Infrastructure`. They sit directly under
  `## Technology Stack`, so `###` is the correct outline level.
- **MD032 (`:36`, `:44`, `:51`)**: insert a blank line between each new `###` heading and the list
  that follows it.

### Step 2 — Fix the "available at" list
- **MD032 (`:98`)**: insert a blank line between `The application will be available at:` and the
  list below it.
- **MD034 (`:98`, `:99`, `:100`)**: wrap the bare URLs in angle brackets —
  `<http://localhost:3000>`, `<http://localhost:3030>`, `<http://localhost:3010>` — keeping the bold
  labels as they are.

Note that the line numbers above refer to the current `main` and shift by one after Step 1 inserts
the blank line under the title; locate the targets by content, not by number.

## Files to Change
- `README.md` — blank lines, three bold labels converted to `###` headings, three URLs wrapped in
  `<...>`.

## Notes
- No CI job lints Markdown locally; verification is Codacy's re-analysis of `main` after merge no
  longer reporting the 11 findings.
- Do not fix unreported findings (MD040 at `:57`, MD031 at `:78`/`:84`) — out of scope per the issue.
- Rendered output should be essentially unchanged; the three tech-stack labels become real headings
  (slightly larger text, and they appear in the document outline).
