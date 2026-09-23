# Plan: Refactor: Login modal helpers: remove object-injection sinks and replace static-only classes with object modules

Issue: [212-refactor-login-modal-helpers-remove-object-injection-sinks-and-replace-static-only-classes-with-object-modules.md](../../issues/212-refactor-login-modal-helpers-remove-object-injection-sinks-and-replace-static-only-classes-with-object-modules.md)

## Overview
Convert `LoginModalHelper` and `LoginModalFormsHelper` from static-only classes to plain exported objects, replace bracket lookups into constant tables with `Map#get`/`Map#has`, remove the now-obsolete Codacy suppressions, and update the frontend helper convention in `.claude/agents/frontend.md`. Frontend-only; rendered markup and behaviour are unchanged.

See [frontend.md](frontend.md) for the full plan.
