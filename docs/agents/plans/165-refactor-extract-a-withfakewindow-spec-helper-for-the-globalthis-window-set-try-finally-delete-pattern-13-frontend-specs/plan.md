# Plan: Refactor: extract a withFakeWindow spec helper for the globalThis.window set/try/finally/delete pattern (13 frontend specs)

Issue: [165-refactor-extract-a-withfakewindow-spec-helper-for-the-globalthis-window-set-try-finally-delete-pattern-13-frontend-specs.md](../../issues/165-refactor-extract-a-withfakewindow-spec-helper-for-the-globalthis-window-set-try-finally-delete-pattern-13-frontend-specs.md)

## Overview
Add a shared spec-support helper, `installFakeWindow(fake)` (plus a paired `uninstallFakeWindow()` for `afterEach`), and migrate the 13 frontend specs that hand-roll a fake `globalThis.window`. All work is inside `frontend/specs/`, so the frontend agent owns it.

See [frontend.md](frontend.md) for the full plan.
