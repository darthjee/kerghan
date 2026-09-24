# Plan: Refactor: Replace static-only admin and accounts page helpers with object modules

Issue: [229-refactor-replace-static-only-admin-and-accounts-page-helpers-with-object-modules.md](../../issues/229-refactor-replace-static-only-admin-and-accounts-page-helpers-with-object-modules.md)

## Overview
Convert four static-only page helper classes into plain default-exported object modules, clearing Codacy's `@typescript-eslint/no-extraneous-class` findings. The frontend agent is the only owner.

See [frontend.md](frontend.md) for the full plan.
