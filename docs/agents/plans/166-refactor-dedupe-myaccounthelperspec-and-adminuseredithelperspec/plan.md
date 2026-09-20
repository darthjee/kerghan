# Plan: Refactor: dedupe MyAccountHelperSpec and AdminUserEditHelperSpec

Issue: [166-refactor-dedupe-myaccounthelperspec-and-adminuseredithelperspec.md](../../issues/166-refactor-dedupe-myaccounthelperspec-and-adminuseredithelperspec.md)

## Overview
Extract the rendering cases shared by `MyAccountHelperSpec.js` and `AdminUserEditHelperSpec.js` into a single example group in `frontend/specs/support/`, mirroring the #163 controller-spec precedent. Frontend-only, test-code-only change.

See [frontend.md](frontend.md) for the full plan.
