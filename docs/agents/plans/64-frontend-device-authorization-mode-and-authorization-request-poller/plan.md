# Plan: Frontend: device-authorization mode and authorization-request poller

Issue: [64-frontend-device-authorization-mode-and-authorization-request-poller.md](../../issues/64-frontend-device-authorization-mode-and-authorization-request-poller.md)

## Overview

Add the login modal's **Authorize with logged device** mode plus a net-new client-side
`AuthorizationRequestPoller`. The user submits only a username, `AccountsClient` creates an
authorization request, and the poller drives it to resolution: `approved` runs the same shared
success handler as password login; `denied` / `expired` / `logged` / not-found each show a
distinct panel with a retry that returns to the empty username form. The waiting state shows a
countdown to `expiresAt`, and the poller is torn down deterministically on modal close, mode
switch, and unmount. Purely frontend — the backend endpoints already exist (#60/#61) and are
unchanged.

See [frontend.md](frontend.md) for the full plan.
