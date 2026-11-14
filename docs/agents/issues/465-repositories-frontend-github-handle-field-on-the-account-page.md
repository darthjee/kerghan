# Issue: Repositories: Frontend — GitHub handle field on the Account page

## Description

Part of Epic #444 (repositories listing), implementation slice **F**. It adds a **GitHub handle section** to the Account page (`#/account/my-account`), so users (the default user included) can set the handle whose public repos feed the Repositories listing.

Spec: `docs/agents/specs/repos/ui.md#github-handle-field`, with the backend contract from `model.md#setting-it-patch-authaccountjson` and `model.md#reading-it-post-authaccountminejson`.

**Depends on:** #460 (Auth GitHub handle routes), already merged: `POST /auth/account/mine.json` exists and `PATCH /auth/account.json` accepts a handle-only body.
**Blocks:** nothing. It can run in parallel with #466 (#463 and #464 are merged).

## Problem

The backend accepts and returns `githubHandle`, but users have no way to set it from the UI. Today `AccountsClient#updateAccount` always sends `currentPassword` and has no `githubHandle`, there is no client call for `POST /auth/account/mine.json`, and the My Account form is not prefilled.

## Expected Behavior

- **A separate section** on the My Account page, with its own input and **Save** button, apart from the username / email / password form. The main form is unchanged: still not prefilled, still asks for the current password, and never sends `githubHandle`.
- **Prefill:** on load the section calls `POST /auth/account/mine.json` and fills the input with `githubHandle` (empty when `null`). Input and button are disabled while loading; on failure the section shows "Could not load your GitHub handle." and stays disabled.
- **Help text:** "Your public GitHub repositories are listed on the Repositories page. Leave empty to remove it."
- **Save** sends `PATCH /auth/account.json` with only `{ githubHandle }`: the trimmed value, or `null` when empty. No current-password field, so it works for the default user.
- **Client-side validation** mirrors the server's after the same normalisation (trim, one leading `@`, lowercase). An invalid value shows the inline field error "Use letters, digits and single hyphens (max 39 characters)." and sends nothing. `@name` and mixed case pass.
- **Server errors** show as the section's own submit alert with `error.message` (the existing `FormFieldsHelper` pattern). A `401` follows the app's usual session handling.
- **Success:** the input takes the response's normalised `githubHandle` (`@DarthJee` shows as `darthjee`), with "GitHub handle updated." or, when cleared, "GitHub handle removed.".
- **Admin pages** (`#/admin/users`, `#/admin/users/:id/edit`) are unchanged: no handle column or field.
- **Tests** (Jasmine, `testing.md#frontend`): the `AccountsClient` additions (`POST /auth/account/mine.json`, the handle-only `PATCH`) in the client spec; the section's load, save and validation flow in controller specs; the section's render states, and no handle on the admin user pages, in render specs. These are the Account-handle items of `ui.md#required-tests`.

## Solution

Frontend only (`frontend/`). Follow `ui.md#github-handle-field` and its "Required tests".

- `AccountsClient` gains a read of the caller's account (`POST /auth/account/mine.json`) and a handle-only update (`PATCH /auth/account.json` with `{ githubHandle }` only). `updateAccount` stays as is, so the main form can never send `githubHandle`.
- The section gets its own controller and render helper, wired into `MyAccount.jsx`, following the existing controller/helper split of the accounts pages.

### Shared rules for this Epic's slices

- **Specs are the source of truth.** If the spec turns out to be wrong or underspecified, this PR updates `docs/agents/specs/repos/` too, and the PR description says what changed.
- This PR adds this issue's row to the "Sub-issues" table in `docs/agents/specs/repos/README.md`.
- No permanent docs (`product.md`, `modules/`, `backend/routes/`, …) change here: #452 folds them in.
- Every test this slice owns, as listed in the "Required tests" sections named below, is written and passes; tiers, fakes and harnesses follow `docs/agents/specs/repos/testing.md`.
