# Device authorization flow
Carry the requesting device's choice through the device-authorization flow and expose it to the
approver.

- `CreateAuthorizationRequestDto`: `@IsOptional() @IsBoolean() keepSignedIn?: boolean;`.
- `AuthorizationRequestController#create`: pass `dto.keepSignedIn ?? false` to the service (stays thin).
- `AuthorizationRequestService#create(username, ip, userAgent, keepSignedIn = false)`: store
  `keepSignedIn` on the saved row. The over-limit early return (no row saved) is unchanged; the
  `create` response shape (`{ uuid, pollToken, expiresAt }`) is unchanged.
- `#issueSessionFor(request)`: `issueTokens(user, request.keepSignedIn)`.
- `OpenAuthorizationRequest` gains `keepSignedIn: boolean`; `listOpenForUser` maps it. Update the
  `mine` controller doc-comment's response shape.
- Approve/deny logic is unchanged — the approver cannot alter the flag.

Specs: `authorization-request.service.create.spec.ts` (flag stored, default `false`),
`authorization-request.service.poll.spec.ts` (winning poll passes the stored flag to `issueTokens`),
`authorization-request.service.listOpenForUser.spec.ts` (field mapped);
`authorization-request.controller.create.e2e-spec.ts` (`"true"`/`1` → `400`, omitted accepted) and
`authorization-request.controller.approver.e2e-spec.ts` (`mine.json` items include `keepSignedIn`).
Update `authorization-request.service.test-support.ts` fixtures as needed.

## Files to Change
- `backend/src/auth/dto/create-authorization-request.dto.ts` — optional strict boolean `keepSignedIn`.
- `backend/src/auth/authorization-request.controller.ts` — pass the flag to `create`; `mine` doc-comment.
- `backend/src/auth/authorization-request.service.ts` — `create` stores the flag; `#issueSessionFor` passes it; `listOpenForUser` maps it.
- `backend/src/auth/authorization-request-result.ts` — `OpenAuthorizationRequest.keepSignedIn`.
- `backend/src/auth/tests/authorization-request.service.*.spec.ts`, `authorization-request.service.test-support.ts`, `authorization-request.controller.create.e2e-spec.ts`, `authorization-request.controller.approver.e2e-spec.ts` — cases above.
