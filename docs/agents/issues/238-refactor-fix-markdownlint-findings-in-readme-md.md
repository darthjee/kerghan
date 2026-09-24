# Issue: Refactor: Fix markdownlint findings in README.md

## Description
`README.md` has structural Markdown problems reported by markdownlint (via Codacy's static analysis of `main`).

## Problem
11 Info findings in `README.md`:

- **MD022** (`:1`) — the `# kerghan` heading needs a blank line below it.
- **MD036** (`:35`, `:43`, `:50`) — `**Backend**`, `**Frontend**` and `**Infrastructure**` are bold text used as headings.
- **MD032** (`:36`, `:44`, `:51`, `:98`) — lists need surrounding blank lines.
- **MD034** (`:98`, `:99`, `:100`) — bare `http://localhost:*` URLs.

## Expected Behavior
The README renders essentially the same, with valid Markdown structure, and Codacy no longer reports the 11 findings above.

## Solution
Documentation-only change to `README.md`, scoped to the 11 findings listed above:

- Add a blank line between `# kerghan` and the tagline on line 2.
- Turn `**Backend**`, `**Frontend**` and `**Infrastructure**` into `### Backend`, `### Frontend` and `### Infrastructure` — they sit under `## Technology Stack`, so `###` is the correct outline level.
- Add a blank line between each of those headings and its list, and between "The application will be available at:" and its list.
- Wrap the three bare local URLs in angle brackets (`<http://localhost:3000>`, `<http://localhost:3030>`, `<http://localhost:3010>`).

Other markdownlint issues in `README.md` that Codacy did not report (e.g. the unlabeled code fence at `:57`, fences inside list items at `:78`/`:84`) are out of scope.

## Benefits
Removes 11 Info findings and improves README structure (the tech-stack subsections become real headings in the outline).

## Verification

- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
