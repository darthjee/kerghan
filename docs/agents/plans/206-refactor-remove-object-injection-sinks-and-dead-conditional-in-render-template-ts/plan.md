# Plan: Refactor: Remove object-injection sinks and dead conditional in render-template.ts

Issue: [206_refactor-remove-object-injection-sinks-and-dead-conditional-in-render-template-ts.md](../issues/206-refactor-remove-object-injection-sinks-and-dead-conditional-in-render-template-ts.md)

## Overview
`backend/src/mail/render-template.ts` looks up values in three plain objects
(`HTML_ESCAPES`, `variables`, `registry`) using bracket notation with a
variable key, and carries a conditional (`if (!raw)`) that can never be true
given the current type of `registry[templateName]`. This plan replaces all
three bracket lookups with `Map`-based lookups and makes the "unknown
template" check test something the type actually allows to be absent —
without touching `template-registry.ts`.

See [backend.md](backend.md) for the full plan.
