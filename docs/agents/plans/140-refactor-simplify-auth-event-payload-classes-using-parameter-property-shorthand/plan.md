# Plan: Refactor: simplify auth event-payload classes using parameter-property shorthand

Issue: [140-refactor-simplify-auth-event-payload-classes-using-parameter-property-shorthand.md](../issues/140-refactor-simplify-auth-event-payload-classes-using-parameter-property-shorthand.md)

## Overview
Collapse the hand-written field-declaration + assignment boilerplate in all six event-payload classes under `backend/src/auth/events/` into TypeScript constructor parameter-property shorthand. Pure syntax cleanup — no behavior, call-site, or field-shape change.

See [backend.md](backend.md) for the full plan.
