# Plan: Refactor: extract a captured-handlers helper for React page specs (AuthorizationRequests, AdminUsers, AdminUserEdit, MyAccount)

Issue: [173-refactor-extract-a-captured-handlers-helper-for-react-page-specs-authorizationrequests-adminusers-adminuseredit-myaccount.md](../../issues/173-refactor-extract-a-captured-handlers-helper-for-react-page-specs-authorizationrequests-adminusers-adminuseredit-myaccount.md)

## Overview
Spec-only refactor inside `frontend/specs/`: extract a `renderCapturingHandlers(Page, Helper)` support helper for the repeated "spy on `Helper.render`, capture the handlers, render the page" block, and a shared example for the duplicated "passes the default state to the helper" test of `MyAccountSpec.js` / `AdminUserEditSpec.js`.

See [frontend.md](frontend.md) for the full plan.
