# frontend Plan: Frontend: My account Authorizations page

Main plan: [plan.md](plan.md)

## Steps

- [01 — AccountsClient methods](frontend/01-accounts-client-methods.md)
- [02 — Routing and page registration](frontend/02-routing-and-page-registration.md)
- [03 — AuthorizationRequests page trio](frontend/03-authorization-requests-page.md)
- [04 — Header "My account" dropdown](frontend/04-header-my-account-dropdown.md)

## CI Checks

- `frontend`: `npm run coverage` (CI job: `jasmine`)
- `frontend`: `npm run lint` (CI job: `frontend-checks`)

## Notes

- No date-formatting library exists in the frontend (checked: no `dayjs`/`moment`/`date-fns`,
  no existing relative-time helper). Compute "age" inline in the helper from `createdAt` with
  plain `Date` math — given the request TTL defaults to 1 hour
  (`KERGHAN_AUTHORIZATION_REQUEST_TTL_MS`), whole minutes elapsed (e.g. `"5 min ago"`) is
  sufficient; no need for hour/day granularity.
- Per the refined issue, the page performs no client-side login check — `load()` always fires,
  and a logged-out `401` is handled entirely by `ApiClient`'s existing refresh/login-modal flow
  (same as `AdminUsers`). Do not add a route guard or a "please log in" branch in the page
  component.
- The "My account" `NavDropdown` is the header's first dropdown grouping — introduced now per
  explicit user decision even though it currently holds a single item, anticipating future
  account pages nesting under it later.
