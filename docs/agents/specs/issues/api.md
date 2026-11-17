# Issues and Projects — API

Principles only; routes and payloads are open.
Part of the [Issues and Projects specs](../issues.md).

- Endpoints are user-scoped.
- Another user's data answers 404.
- Controllers stay thin; business logic lives in each module's service.
- Responses carry ids, never secrets.
- The shortcut answers `200` for an existing project and `201` for a new one ([projects.md](projects.md#creation-paths)).
- `409` answers a name collision, a repository that already has a project (explicit path and attach), a not-added repository on the shortcut, and a change or detach of a repository only while links exist; the refusal carries the link count, and the exact payload and code are #489's ([projects.md](projects.md#changing-a-project-later)). An unlink without the plain confirmation while unsent changes exist, and an attach whose `updated_at` confirmation is stale when the local values differ from GitHub's (the refusal carries the current differences), are also `409` refusals whose codes #489 names; unlinking an issue with no link is a distinct refusal from "issue not found" ([github-link.md](github-link.md)).
- A deleted project answers `404` like another user's; a rejected repository reference never reveals whether the row exists ([projects.md](projects.md#deletion)).
- Title and body length caps (256 and 65536 characters) come from [model.md](model.md#issues-kerghan-issues); the issues listing sort and its index are #489's decision.

## Open questions

- [ ] Routes and payloads. (#489)
- [ ] Error codes and shapes. (#489)
- [ ] Pagination and filtering. (#489)
- [ ] Input validation. (#489)
- [ ] How sync state is exposed, including the failed and rate-limited states with their reason, and the "retry sync" trigger (E18 of [edge-cases.md](edge-cases.md)). (#489)
- [ ] Cache classes of each endpoint. (#489)

## Required tests

Default tier: e2e with fakes ([testing.md](testing.md#default-tier-by-category)).

- Another user's project or issue answers 404, and so does a deleted project (one row of the route access matrix, [testing.md](testing.md#security-verification)).
- The `200`/`201`/`409` outcomes of the project creation paths in [projects.md](projects.md#creation-paths).
- A repository change or detach answers `409` with the link count only while the project has links, and succeeds at zero; unlink answers `409` without its confirmation and attach answers `409` on a stale `updated_at`; a repeat unlink answers a distinct "not linked" refusal (E61 to E64 of [edge-cases.md](edge-cases.md)).
- Every route answers `401` without a session, runs `OriginGuard` and sends `X-Skip-Cache` (the access matrix, complete against the registered routes).
