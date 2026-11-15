# Issues and Projects — API

Principles only; routes and payloads are open.
Part of the [Issues and Projects specs](../issues.md).

- Endpoints are user-scoped.
- Another user's data answers 404.
- Controllers stay thin; business logic lives in each module's service.
- Responses carry ids, never secrets.

## Open questions

- [ ] Routes and payloads. (#489)
- [ ] Error codes and shapes. (#489)
- [ ] Pagination and filtering. (#489)
- [ ] Input validation. (#489)
- [ ] How sync state is exposed. (#489)
- [ ] Cache classes of each endpoint. (#489)

## Required tests

- Another user's project or issue answers 404.
