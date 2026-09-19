# Issue: Refactor: simplify auth event-payload classes using parameter-property shorthand

## Description
All six event-payload classes under `src/auth/events/` hand-write field declarations plus a constructor that just assigns each parameter to the matching field.

## Problem
`authorization-request-approved.event.ts`, `authorization-request-created.event.ts`, `authorization-request-denied.event.ts`, `authorization-request-logged.event.ts`, `password-recovery-requested.event.ts`, and `user-registered.event.ts` each follow the identical shape:

```ts
export class SomeEvent {
  readonly fieldA: string;
  readonly fieldB: number;

  /**
   * @param {string} fieldA - Description of fieldA.
   * @param {number} fieldB - Description of fieldB.
   */
  constructor(fieldA: string, fieldB: number) {
    this.fieldA = fieldA;
    this.fieldB = fieldB;
  }
}
```

This is pure boilerplate repeated six times with no other logic in any of the classes. Each class also carries a class-level JSDoc comment (describing when/how the event fires) plus a `@param` doc comment per constructor argument. `password-recovery-requested.event.ts` in particular has security-relevant notes on its `token` param (plaintext exists only in-flight, only the hash is persisted) that must not be lost in the rewrite.

## Expected Behavior
Each event class keeps its exact public shape: same field names and types, same construction call sites, same runtime behavior. The class-level JSDoc comment stays as-is above the class. Each constructor parameter existing `@param` documentation is preserved, moved to an inline comment directly on its own parameter-property line, rather than dropped or left as a block above the constructor.

## Solution
Rewrite each of the six classes using TypeScript constructor parameter-property shorthand, moving each parameter doc text inline, e.g.:

```ts
/**
 * Fired ... (class-level doc unchanged)
 */
export class SomeEvent {
  constructor(
    /** Description of fieldA. */
    readonly fieldA: string,
    /** Description of fieldB. */
    readonly fieldB: number,
  ) {}
}
```

## Benefits
Shrinks each event class from roughly 10-25 lines to about half that, removing repeated field-declaration and assignment boilerplate with no behavior change and no documentation loss. Purely a readability and consistency cleanup.
