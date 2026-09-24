# Plan: Refactor: Replace static-only classes AuthSession, AuthEvents and LoginModalEvents with object modules

Issue: [228-refactor-replace-static-only-classes-authsession-authevents-and-loginmodalevents-with-object-modules.md](../../issues/228-refactor-replace-static-only-classes-authsession-authevents-and-loginmodalevents-with-object-modules.md)

## Overview
Convert the three remaining static-only client classes, `AuthSession`, `AuthEvents` and `LoginModalEvents`, into plain exported object literals. This clears Codacy's 3 `@typescript-eslint/no-extraneous-class` findings. The work is frontend-only and follows the pattern set by #227.

See [frontend.md](frontend.md) for the full plan.
