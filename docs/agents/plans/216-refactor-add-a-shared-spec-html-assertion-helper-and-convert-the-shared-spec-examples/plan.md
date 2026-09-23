# Plan: Refactor: Add a shared spec HTML-assertion helper and convert the shared spec examples

Issue: [216-refactor-add-a-shared-spec-html-assertion-helper-and-convert-the-shared-spec-examples.md](../../issues/216-refactor-add-a-shared-spec-html-assertion-helper-and-convert-the-shared-spec-examples.md)

## Overview
Add a string-wrapper assertion helper under `frontend/specs/support/` so rendered markup never reaches `expect(...)` directly. Convert the two shared account-edit example files and their two caller specs to it. Before opening the PR, run the real `xss/no-mixed-html` rule once to check that the approach clears Codacy's findings.

See [frontend.md](frontend.md) for the full plan.
