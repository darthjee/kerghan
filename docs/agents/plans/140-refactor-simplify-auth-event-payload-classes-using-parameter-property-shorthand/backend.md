# backend Plan: Refactor: simplify auth event-payload classes using parameter-property shorthand

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Rewrite the six event classes with parameter-property shorthand

For each file below, keep the class-level JSDoc block unchanged above `export class ...`, keep
the exact field names/types and the exact class/export name, keep every call site untouched
(they already pass positional args in the same order), delete the `readonly field: Type;`
declarations and the assignment-only constructor body, and replace the constructor with
parameter-property shorthand. Move each parameter's existing `@param {Type} name - text` doc
line to an inline `/** text */` comment directly above (or preceding) its own `readonly
name: Type,` parameter line — do not drop any of it, and do not leave a `@param`-style block
above the constructor.

- `authorization-request-approved.event.ts` — `AuthorizationRequestApprovedEvent(uuid: string,
  approvedByUserId: number)`.
- `authorization-request-created.event.ts` — `AuthorizationRequestCreatedEvent(uuid: string,
  username: string, userId: number | null)`.
- `authorization-request-denied.event.ts` — `AuthorizationRequestDeniedEvent(uuid: string,
  deniedByUserId: number)`.
- `authorization-request-logged.event.ts` — `AuthorizationRequestLoggedEvent(uuid: string,
  userId: number)`.
- `user-registered.event.ts` — `UserRegisteredEvent(userId: number, username: string,
  email: string)`.
- `password-recovery-requested.event.ts` — `PasswordRecoveryRequestedEvent(userId: number,
  token: string, resetUrl: string, email: string)`. Preserve the `token` param's security note
  verbatim (plaintext exists only in-flight, only its hash is persisted) in its inline comment —
  this is the one field in the batch with security-relevant documentation.

Target shape (illustrated with the two-field case):

```ts
/**
 * Fired (via `EventEmitter2`, event name `authorization-request.approved`)
 * when the approver device authorizes a device-authorization request. No
 * listener consumes it yet — out of scope for this issue — it only needs to
 * fire with the right payload.
 */
export class AuthorizationRequestApprovedEvent {
  constructor(
    /** The authorization request UUID. */
    readonly uuid: string,
    /** The ID of the user who approved the request. */
    readonly approvedByUserId: number,
  ) {}
}
```

No other file references these classes' internal shape (no spec under `backend/src/auth/tests/`
imports or constructs any of the six), so no test changes are needed — this is confirmed by
`grep -rl` returning no test files for any of the six class names.

## Files to Change

- `backend/src/auth/events/authorization-request-approved.event.ts` — collapse to
  parameter-property shorthand.
- `backend/src/auth/events/authorization-request-created.event.ts` — collapse to
  parameter-property shorthand.
- `backend/src/auth/events/authorization-request-denied.event.ts` — collapse to
  parameter-property shorthand.
- `backend/src/auth/events/authorization-request-logged.event.ts` — collapse to
  parameter-property shorthand.
- `backend/src/auth/events/user-registered.event.ts` — collapse to parameter-property shorthand.
- `backend/src/auth/events/password-recovery-requested.event.ts` — collapse to
  parameter-property shorthand, preserving the `token` field's security note.

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests` — runs `npm run coverage`)
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks` — runs `npm run lint`)

## Notes

- Pure syntax cleanup: field names, types, export names, and every construction call site
  (`new SomeEvent(a, b, ...)`, still positional) stay identical, so no behavior, caller, or
  listener change anywhere else in the codebase.
- `password-recovery-requested.listener.ts` (the one file that actually consumes an event from
  this batch, `PasswordRecoveryRequestedEvent`) reads fields off the instance (`event.email`,
  `event.token`, etc.) — unaffected, since the public field shape does not change.
- `eslint.config.mjs` has no rule against TypeScript parameter properties, so no lint config
  change is needed to allow this pattern.
