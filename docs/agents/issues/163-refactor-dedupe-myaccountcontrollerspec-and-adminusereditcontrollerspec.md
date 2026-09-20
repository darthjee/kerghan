# Issue: Refactor: dedupe MyAccountControllerSpec and AdminUserEditControllerSpec

## Description
The two controller specs are near-copies of each other (~70 duplicated lines), mirroring the controllers, which were already deduplicated in #162 (shared `AccountEditFormController` base class).

## Problem
jscpd finds:

- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/MyAccountControllerSpec.js` lines 43-101 ↔ `.../admin/pages/controllers/AdminUserEditControllerSpec.js` lines 34-92 — a 59-line clone.
- Another 11-line clone at lines 14-24 ↔ 13-23 (shared setup), and a 7-line self-clone inside `AdminUserEditControllerSpec.js` (157-163 ↔ 110-116).

The two specs differ only in: the client method (`updateAccount` vs `editUser`), the `handleSubmit` signature (`fields` vs `userId, fields`), the response shape (flat vs `{user}`), and MyAccount's extra `currentPassword` field.

## Expected Behavior
The shared validation/submit/payload cases are written once, as a shared example group parameterised by controller factory and field set, and run for both controllers. Coverage of both controllers is unchanged or higher, and every subclass override (MyAccount: `validate`/`buildPayload`/`clearedFields`; Admin: `extractAccount`/`handleSubmitError`) remains covered end to end through the subclass.

## Solution
The shared-controller extraction (#162) is already merged, so the spec structure can now follow the production structure.

- Add a shared spec-support module at `frontend/specs/support/` (e.g. `accountEditFormControllerExamples.js`) that registers the common `describe` blocks. Its file name must not end in `Spec.js`/`spec.js`, so Jasmine (`specs/**/*[sS]pec.js`) does not run it as a spec on its own.
- Parameterise it by controller factory (setup/build, client method spy, `handleSubmit` invocation adapter, response-shape adapter) and by the field set (base blank fields; MyAccount adds `currentPassword`).
- Share the **superset** of cases: cases that only one spec has today but that apply to both (e.g. the 'password too short' submit error, currently only in the admin spec) move into the shared group and so start running for both controllers.
- Keep only controller-specific cases in each spec file: MyAccount — `currentPassword` required, wrong-current-password submit error, `currentPassword` in the payload and cleared on success; Admin — `userId` passing and the `403` redirect-home behaviour.
- Leave `AccountEditFormControllerSpec` (base class, added in #162) as is.

## Benefits
Fewer lines to maintain, and one place to add a validation case that applies to both edit forms.
