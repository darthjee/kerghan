# Frontend Plan: Refactor: Remove dynamic-key access in shared spec support and RegisterControllerSpec

Main plan: [plan.md](plan.md)

## Overview
Replace every computed-key member access (`obj[variable]`) flagged by Codacy in the frontend spec support and `RegisterControllerSpec` with explicit references, keeping the same examples and outcomes.

## Context
Codacy reports 8 High `security/detect-object-injection` findings:

- `frontend/specs/support/accountEditFormControllerExamples.js` — `context.client[clientMethod]` at lines 83, 87, 140, 168, 177, 202 (line 210 uses the same pattern too).
- `frontend/specs/support/fetchSequence.js:35` — `responses[call]`. It already has an `eslint-disable-next-line security/detect-object-injection` comment, but Codacy ignores it, so the code itself must change.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js:70` — `controller.validate({ ... })[field]`.

The shared examples are consumed by `AdminUserEditControllerSpec.js` and `MyAccountControllerSpec.js`. They reference `context.client.editUser` / `context.client.updateAccount` with static keys, and must keep working unchanged.

## Implementation Steps

### Step 1 — Expose a single client spy in the shared account-edit examples
In `itBehavesLikeAnAccountEditFormController`'s `beforeEach`, replace `context.client = jasmine.createSpyObj('client', [clientMethod]);` with:

```js
context.clientSpy = jasmine.createSpy(clientMethod);
context.client = Object.fromEntries([[clientMethod, context.clientSpy]]);
```

Then, in `registerPayloadExamples`, `registerOutcomeExamples` and `registerSkippedCallExamples`, replace every `context.client[clientMethod]` with `context.clientSpy`. Drop `clientMethod` from those functions' option destructuring if it is no longer used there. Keep the public `clientMethod` option, and update the JSDoc (`@returns` / context description) to mention `context.clientSpy`. `context.client` still exposes the method under its real name, so the callers' `context.client.updateAccount` / `context.client.editUser` usages need no change.

### Step 2 — Remove computed indexing in fetchSequence and RegisterControllerSpec
- `fetchSequence.js`: replace `responses[call]` with `responses.at(call)` and delete the now-unneeded two-line `eslint-disable-next-line` comment above it.
- `RegisterControllerSpec.js`: replace `expect(controller.validate({ ...validFields, ...override })[field]).toBeDefined();` with `expect(Object.keys(controller.validate({ ...validFields, ...override }))).toContain(field);`.

## Files to Change
- `frontend/specs/support/accountEditFormControllerExamples.js` — create `context.clientSpy`, build `context.client` via `Object.fromEntries`, and use `context.clientSpy` in the examples. Update the JSDoc.
- `frontend/specs/support/fetchSequence.js` — `responses.at(call)`, and remove the eslint-disable comment.
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js` — assert on `Object.keys(...)` containing `field`.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` (coverage must not drop).

## Notes
- Do not change `AdminUserEditControllerSpec.js` or `MyAccountControllerSpec.js`. Their static-key access to `context.client` is not flagged.
- `accountEditFormControllerExamples.js` and `fetchSequence.js` also have PMD "Unnecessary block" findings, tracked by the spec-support PMD issue. If that issue merges first, rebase on it and resolve any overlap.
- `Object.keys(...).toContain(field)` is slightly stricter than `toBeDefined()` only for a key whose value is `undefined`. `validate` never produces that, so behaviour is unchanged.
