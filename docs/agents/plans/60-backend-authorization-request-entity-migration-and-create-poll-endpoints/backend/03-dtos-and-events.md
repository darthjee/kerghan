# DTOs and events

Small POJOs/classes, no logic — mirror the existing patterns exactly.

## DTOs

Mirror `login.dto.ts` (`@IsString @IsNotEmpty`, definite-assignment `!` fields, no constructor).

## Events

Mirror `user-registered.event.ts` — plain class, `readonly` fields, JSDoc'd constructor, dotted
event name matching the `user.registered` / `password-recovery.requested` convention. No listener
is wired up for either — only define and emit the classes (emission happens in Step 4's service).

## Files to Change

- `backend/src/auth/dto/create-authorization-request.dto.ts` — new. `{ username: string }`,
  `@IsString @IsNotEmpty`.
- `backend/src/auth/dto/poll-authorization-request.dto.ts` — new. `{ pollToken: string }`,
  `@IsString @IsNotEmpty`.
- `backend/src/auth/events/authorization-request-created.event.ts` — new. Class
  `AuthorizationRequestCreatedEvent`, event name `authorization-request.created`. Fields: at least
  `uuid: string`; add whatever else is useful for a future listener (e.g. `username`) without
  over-engineering — keep it a plain data carrier like `UserRegisteredEvent`.
- `backend/src/auth/events/authorization-request-logged.event.ts` — new. Class
  `AuthorizationRequestLoggedEvent`, event name `authorization-request.logged`. Fields: at least
  `uuid: string`, `userId: number`.
