# Issue: Frontend: "Keep me signed in" checkbox

## Description

Part of #318 — "Keep me signed in". This is the frontend half of the option; the backend half (#319) is
merged and accepts an optional boolean `keepSignedIn` on `POST /auth/login.json` and on the device
authorization-request create (`POST /auth/authorization-requests.json`), and exposes `keepSignedIn`
on each open request returned to the approver.

## Problem

The login modal (`frontend/assets/js/components/common/loginModal/`) has no way for the user to opt
into a long-lived session, so every login gets the regular refresh-token TTL (default 7 days) even
though the backend now supports a persistent, renewing one (default 30 days). The approver on the
Authorization Requests page also cannot see that a requesting device asked to stay signed in.

## Expected Behavior

- A **"Keep me signed in"** checkbox on the **Password** tab and on the **Authorize with logged
  device** tab (on the requesting device) of the login modal. Not on Register, Recover or
  Set-new-password.
- **Unchecked by default** and **never remembered**: it always starts unchecked, including when the
  modal is reopened (e.g. from the session-expired flow) and when switching tabs (consistent with the
  modal resetting every field on mode switch).
- Its value is sent as `keepSignedIn` (a real boolean) on the login request and on the
  authorization-request create.
- No change to how the refresh token is stored client-side (`AuthSession` / `localStorage`).
- On the approver's **Authorization Requests** page, open requests whose `keepSignedIn` is `true`
  show a small **"Keep signed in"** badge next to the request's age in the Age cell. The table
  keeps its current columns, and rows without the flag show no badge. Approve/deny actions are
  unchanged.
- The checkbox is a plain label ("Keep me signed in") with no helper text. No duration is shown
  because the TTL can be changed through env vars.

## Solution

- Add `keepSignedIn: false` to the modal's `INITIAL_FIELDS` (in both `LoginModal.jsx` and
  `LoginModalController.js`) so `switchMode` resets it, plus a checkbox change handler.
- `LoginModalFormsHelper.jsx`: render the checkbox in the Password and device forms only.
- `AccountsClient.login` sends `{ username, password, keepSignedIn }`;
  `AccountsClient.createAuthorizationRequest(username, keepSignedIn)` sends it in the create body.
  `LoginModalController#submitPassword` / `#submitDevice` pass the field through.
- `AuthorizationRequestsHelper.jsx`: render the "Keep signed in" badge in the Age cell for rows with
  `keepSignedIn === true`.

### Testing

Jasmine specs: the checkbox renders on the Password and device tabs (and not on the others),
defaults to unchecked, resets on mode switch, and is sent as `keepSignedIn` by both client calls;
the approver indicator renders only when the flag is set.

### Agents

frontend.

## Benefits

Users can choose a session that practically never expires while they stay active, and approvers can
make an informed decision before authorizing a long-lived session on another device.
