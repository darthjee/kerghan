# DTO and events

Add the request body validator for `authorize.json` and the two new domain events
(`authorization-request.approved` / `.denied`), mirroring the shape of the existing
create/poll DTOs and the `authorization-request-created`/`-logged` events. `deny.json` needs no
DTO — its body is `{}`.

## Files to Change

- `backend/src/auth/dto/authorize-authorization-request.dto.ts` (new) — `{ password }`,
  `@IsString @IsNotEmpty`, same shape as `dto/poll-authorization-request.dto.ts`.
- `backend/src/auth/events/authorization-request-approved.event.ts` (new) —
  `AuthorizationRequestApprovedEvent(uuid: string, approvedByUserId: number)`, mirroring
  `authorization-request-created.event.ts`'s doc-comment/readonly-fields style. No listener
  required.
- `backend/src/auth/events/authorization-request-denied.event.ts` (new) —
  `AuthorizationRequestDeniedEvent(uuid: string, deniedByUserId: number)`, same style. No
  listener required.
