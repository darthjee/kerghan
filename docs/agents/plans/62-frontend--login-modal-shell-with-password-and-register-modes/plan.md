# Plan: Frontend: login modal shell with Password and Register modes

Issue: [62-frontend--login-modal-shell-with-password-and-register-modes.md](../issues/62-frontend--login-modal-shell-with-password-and-register-modes.md)

## Overview

Replace the full-page `#/login` / `#/register` navigations with a single route-independent
`LoginModal`, opened via a new `client/LoginModalEvents.js` bus from the header and from
`ApiClient#sessionExpired`. Entirely frontend work, no backend changes.

See [frontend.md](frontend.md) for the full plan.
