# Issue: Refactor: Remove dynamic-key access in shared spec support and RegisterControllerSpec

## Description
Shared frontend spec support drives client stubs by method-name string and indexes arrays/objects with computed keys, which Codacy flags as object injection.

## Problem
`security/detect-object-injection` (High), 8 findings:

- `frontend/specs/support/accountEditFormControllerExamples.js:83,87,140,168,177,202` — `context.client[clientMethod]` (line 210 uses the same pattern and should be fixed too)
- `frontend/specs/support/fetchSequence.js:35` — `responses[call]` (it already has an `eslint-disable-next-line security/detect-object-injection` comment; Codacy still reports it, so a suppression is not enough)
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js:70` — `controller.validate({ ... })[field]`

## Expected Behavior
The shared examples and specs keep the same cases and pass/fail behaviour, with no computed-key member access left in the files above.

## Solution
- **`accountEditFormControllerExamples.js`**: keep the `clientMethod` string option (callers `AdminUserEditControllerSpec.js` and `MyAccountControllerSpec.js` stay unchanged). In the setup (currently `jasmine.createSpyObj('client', [clientMethod])`), create a single spy and expose it on the context:
  ```js
  context.clientSpy = jasmine.createSpy(clientMethod);
  context.client = Object.fromEntries([[clientMethod, context.clientSpy]]);
  ```
  Replace every `context.client[clientMethod]` in the shared examples with `context.clientSpy`. Update the JSDoc to describe `context.clientSpy`.
- **`fetchSequence.js`**: use `responses.at(call)` and remove the now-unneeded `eslint-disable-next-line` comment.
- **`RegisterControllerSpec.js`**: replace `expect(controller.validate(...)[field]).toBeDefined()` with `expect(Object.keys(controller.validate(...))).toContain(field)`.

Note: `accountEditFormControllerExamples.js` and `fetchSequence.js` also carry PMD "Unnecessary block" findings, handled by the spec-support PMD issue — rebase on it if merged first.

## Benefits
Removes 8 High findings, and the shared examples reference one explicit spy instead of computed lookups.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
