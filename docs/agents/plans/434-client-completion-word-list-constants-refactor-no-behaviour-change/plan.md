# Plan: Client: completion word-list constants (refactor, no behaviour change)

Issue: [434-client-completion-word-list-constants-refactor-no-behaviour-change.md](../../issues/434-client-completion-word-list-constants-refactor-no-behaviour-change.md)

## Overview
A refactor of `standalone/bin/kerghan` that changes no behaviour. It adds four per-key value constants and a `FRONTEND_BASE_URL` env-key constant, makes the validators and their messages read them, and documents the `BASH_SOURCE` guard. That way #429 can generate completion from the data the client validates against.

See [standalone.md](standalone.md) for the full plan.
