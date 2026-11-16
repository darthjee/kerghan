# Issues and Projects — API

Principles only; routes and payloads are open.
Part of the [Issues and Projects specs](../issues.md).

- Endpoints are user-scoped.
- Another user's data answers 404.
- Controllers stay thin; business logic lives in each module's service.
- Responses carry ids, never secrets.
- The shortcut answers `200` for an existing project and `201` for a new one ([projects.md](projects.md#creation-paths)).
- `409` answers a name collision, a repository that already has a project (explicit path and attach), a not-added repository on the shortcut, and a change or detach of a repository ([projects.md](projects.md)).
- A deleted project answers `404` like another user's; a rejected repository reference never reveals whether the row exists ([projects.md](projects.md#deletion)).

## Open questions

- [ ] Routes and payloads. (#489)
- [ ] Error codes and shapes. (#489)
- [ ] Pagination and filtering. (#489)
- [ ] Input validation. (#489)
- [ ] How sync state is exposed. (#489)
- [ ] Cache classes of each endpoint. (#489)

## Required tests

- Another user's project or issue answers 404, and so does a deleted project.
- The `200`/`201`/`409` outcomes of the project creation paths in [projects.md](projects.md#creation-paths).
