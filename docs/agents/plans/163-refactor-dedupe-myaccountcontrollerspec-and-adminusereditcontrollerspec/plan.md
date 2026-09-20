# Plan: Refactor: dedupe MyAccountControllerSpec and AdminUserEditControllerSpec

Issue: [163-refactor-dedupe-myaccountcontrollerspec-and-adminusereditcontrollerspec.md](../../issues/163-refactor-dedupe-myaccountcontrollerspec-and-adminusereditcontrollerspec.md)

## Overview
Extract the validate/submit/payload cases that `MyAccountControllerSpec` and `AdminUserEditControllerSpec` duplicate into one parameterised shared example group under `frontend/specs/support/`, and keep only controller-specific cases in each spec file. Frontend-only, specs-only change: no production code changes.

See [frontend.md](frontend.md) for the full plan.
