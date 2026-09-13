# Extend backend/routes/auth.md with the five new endpoints

`docs/agents/backend/routes/auth.md` currently documents only the four classic auth routes, each
with its own `### METHOD /path.json` subsection and a `| Property | Value |` table (Controller,
Auth, Request body, Success response, HTTP status), plus prose notes below the table. Add one
matching subsection per new endpoint, sourced from
`backend/src/auth/authorization-request.controller.ts`'s JSDoc (already accurate — it's the
freshest description of each route's contract):

- `POST /auth/authorization-requests.json` (`@Public()`)
- `POST /auth/authorization-requests/:uuid/poll.json` (`@Public()`)
- `POST /auth/authorization-requests/mine.json` (authenticated)
- `POST /auth/authorization-requests/:uuid/authorize.json` (authenticated)
- `POST /auth/authorization-requests/:uuid/deny.json` (authenticated)

Controller is `AuthorizationRequestController`
(`auth/authorization-request.controller.ts`) for all five — different from the existing four
routes' `AuthController`, so the per-endpoint tables must say so explicitly (don't copy the
existing "Controller: AuthController" value).

Also extend the "Shared behavior" section: all five routes set `X-Skip-Cache: true` too (same
Tent-caching rationale already documented for the classic four) — fold them into the existing
paragraph's route list rather than writing a second near-duplicate paragraph.

The winning `poll` response reuses `respondWithSession`/the same cookie-setting code as
login/register/refresh (see `backend/src/auth/auth-response.ts`) — cross-reference the existing
"Access token cookie" section rather than re-describing the cookie attributes.

Add a new "Source files" row set (or a second table) for:
`auth/authorization-request.controller.ts`, `auth/authorization-request.service.ts`,
`auth/authorization-request-abuse-guard.service.ts`, `auth/entities/authorization-request.entity.ts`,
`auth/dto/create-authorization-request.dto.ts`, `auth/dto/poll-authorization-request.dto.ts`,
`auth/dto/authorize-authorization-request.dto.ts`.

## Files to Change

- `docs/agents/backend/routes/auth.md` — add five `### METHOD /path.json` subsections (one per
  new endpoint, matching the existing table shape), extend "Shared behavior" to include them, and
  extend "Source files" with the new controller/service/entity/DTO files.
