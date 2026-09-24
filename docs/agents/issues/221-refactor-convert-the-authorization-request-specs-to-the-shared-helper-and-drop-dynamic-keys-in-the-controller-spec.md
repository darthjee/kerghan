# Issue: Refactor: Convert the authorization-request specs to the shared helper and drop dynamic keys in the controller spec

## Description
The authorization-request page/helper specs assert on markup strings, and the controller spec drives `authorize`/`deny` through method-name strings.

## Problem
Under `frontend/specs/assets/js/components/resources/accounts/pages/`:

- `helpers/AuthorizationRequestsHelperSpec.js` — 19 `xss/no-mixed-html` (High)
- `AuthorizationRequestsSpec.js` — 2 `xss/no-mixed-html` (High)
- `controllers/AuthorizationRequestsControllerSpec.js:73,77,79,87,90,98` — 6 `security/detect-object-injection` (High): `client[clientMethod]` and `controller[method](...args)` in the `itBehavesLikeRowAction` shared example used by `#authorize` / `#deny`

Depends on #216 (shared helper), which has already merged.

## Expected Behavior
Same cases, same assertions, same results. No production code changes; spec-only refactor.

## Solution
- **Markup specs:** convert both files to the shared `renderedOutput` HTML-assertion helper introduced in #216 (and extended with `containsAttribute` in #219), following the same conversions done in #218 / #219 / #220.
- **Controller spec:** in `itBehavesLikeRowAction`, replace the `method` / `clientMethod` string params with functions, following the `stub` / `act` pattern established in `AdminUsersControllerSpec` (#219):
  - `stub: (client) => client.authorize` (used both for `.and.resolveTo` / `.and.rejectWith` and for the `toHaveBeenCalledWith(...args)` assertion)
  - `act: (controller, ...args) => controller.authorize(...args)`. It takes args because the success and 400 cases call it with different argument lists (`args` vs `errorArgs`).
  - Keep the success / 400 / expired-session cases intact for both `#authorize` and `#deny`.

## Benefits
Removes 27 High Codacy findings from three files.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
