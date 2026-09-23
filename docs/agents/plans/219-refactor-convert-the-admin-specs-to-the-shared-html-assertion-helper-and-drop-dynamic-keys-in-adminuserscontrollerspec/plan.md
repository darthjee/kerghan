# Plan: Refactor: Convert the admin specs to the shared HTML-assertion helper and drop dynamic keys in AdminUsersControllerSpec

Issue: [219-refactor-convert-the-admin-specs-to-the-shared-html-assertion-helper-and-drop-dynamic-keys-in-adminuserscontrollerspec.md](../../issues/219-refactor-convert-the-admin-specs-to-the-shared-html-assertion-helper-and-drop-dynamic-keys-in-adminuserscontrollerspec.md)

## Overview
Spec-only frontend refactor. It clears the remaining High Codacy findings in the admin page specs by moving them onto the shared `renderedOutput` helper, which gains a `containsAttribute` query, and by replacing the method-name strings in `AdminUsersControllerSpec` with functions.

See [frontend.md](frontend.md) for the full plan.
