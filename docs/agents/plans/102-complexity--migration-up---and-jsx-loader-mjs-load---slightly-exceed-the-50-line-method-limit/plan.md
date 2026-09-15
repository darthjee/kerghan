# Plan: Complexity: migration up() and jsx-loader.mjs load() slightly exceed the 50-line method limit

Issue: [102-complexity--migration-up---and-jsx-loader-mjs-load---slightly-exceed-the-50-line-method-limit.md](../../issues/102-complexity--migration-up---and-jsx-loader-mjs-load---slightly-exceed-the-50-line-method-limit.md)

## Overview

Two unrelated methods each slightly exceed Codacy's Lizard `nloc-medium` limit
(50 lines): the `AuthCreateAuthorizationRequests20260903120008` migration's
`up()` (52 lines) in the backend, and `jsx-loader.mjs`'s `load()` (55 lines)
in the frontend. Both are fixed the same way — extracting inline logic into
small local helper functions/constants in the same file — with no behavior
change. The two fixes are independent and dispatched to their respective
specialists in parallel.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

None — the two fixes touch unrelated files in unrelated modules, each fully
contained within its own agent's file. There is no interface, schema, or
value crossing between them.
