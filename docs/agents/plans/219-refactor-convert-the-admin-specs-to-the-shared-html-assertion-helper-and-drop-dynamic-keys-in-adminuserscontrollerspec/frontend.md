# Frontend Plan: Refactor: Convert the admin specs to the shared HTML-assertion helper and drop dynamic keys in AdminUsersControllerSpec

Main plan: [plan.md](plan.md)

## Overview
Convert `AdminUsersHelperSpec` and `AdminUsersSpec` from `renderToStaticMarkup` string checks to `renderedOutput`, add `containsAttribute(name, value)` to the helper so the edit-link `href` check stays just as strict, and make the 403 example in `AdminUsersControllerSpec` take functions instead of method-name strings. No production code changes.

## Context
The issue lists 27 High findings: 21 + 2 `xss/no-mixed-html` in `AdminUsersHelperSpec` / `AdminUsersSpec`, 2 in `AdminUserEditHelperSpec` (already expected to be clean since #216), and 2 `security/detect-object-injection` in `AdminUsersControllerSpec` (`client[clientMethod]` and `controller[method](...args)`). The pattern to follow is `LoginModalFormsHelperSpec` (#218).

## Steps

- [01 — Add containsAttribute to renderedOutput](frontend/01-add-contains-attribute.md)
- [02 — Convert the admin markup specs to renderedOutput](frontend/02-convert-admin-markup-specs.md)
- [03 — Replace dynamic keys in AdminUsersControllerSpec](frontend/03-replace-dynamic-keys-in-controller-spec.md)

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` (CircleCI `yarn_project` jobs)

## Notes
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js` is verify-only. It already uses `itBehavesLikeAnAccountEditFormHelper` and `page.contains(...)` after #216. Change it only if lint still flags it.
- Keep every existing case and assertion. Coverage must not drop.
- Never run `yarn` on the host. Always go through `docker-compose`.
