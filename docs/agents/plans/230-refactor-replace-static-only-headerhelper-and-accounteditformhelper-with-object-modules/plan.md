# Plan: Refactor: Replace static-only HeaderHelper and AccountEditFormHelper with object modules

Issue: [230-refactor-replace-static-only-headerhelper-and-accounteditformhelper-with-object-modules.md](../../issues/230-refactor-replace-static-only-headerhelper-and-accounteditformhelper-with-object-modules.md)

## Overview
Convert `HeaderHelper` and `AccountEditFormHelper` from static-only classes to default-exported object literals, following the #229 pattern. Then trim the `reportUnusedDisableDirectives: 'off'` override in `frontend/eslint.config.mjs` down to the files that still have a Codacy-only disable comment.

See [frontend.md](frontend.md) for the full plan.
