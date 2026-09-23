# Plan: Refactor: Guard file reads in the spec JSX loader

Issue: [215-refactor-guard-file-reads-in-the-spec-jsx-loader.md](../../issues/215-refactor-guard-file-reads-in-the-spec-jsx-loader.md)

## Overview
Route every file read in `frontend/specs/support/jsx-loader.mjs` through one exported `readSource(url)` helper. The helper throws for paths outside the frontend root, and a new Jasmine spec covers it.

See [frontend.md](frontend.md) for the full plan.
