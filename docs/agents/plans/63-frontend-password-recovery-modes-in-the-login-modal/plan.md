# Plan: Frontend: password-recovery modes in the login modal

Issue: [63-frontend-password-recovery-modes-in-the-login-modal.md](../../issues/63-frontend-password-recovery-modes-in-the-login-modal.md)

## Overview

Fold the two password-recovery flows into the #62 login modal: a selectable **Recover** tab
(email → `AccountsClient.recover`, always showing a neutral panel) and a programmatic-only
**Set new password** mode entered via `LoginModalEvents.open('resetPassword', { token })`
(validated with `ResetPasswordController.validate()`, calls `AccountsClient.resetPassword`,
shows a success panel with a "back to log in" link, never auto-logs-in). `ResetPassword.jsx`
becomes a redirect-only `ResetPasswordLanding.jsx`; the `Recover.jsx` page trio, the
`#/recover` route, and the `PAGES.recover` entry are deleted; the header's Recover control is
rewired through the modal.

This is a frontend-only change. See [frontend.md](frontend.md) for the full plan.
