# Plan: Frontend: My account Authorizations page

Issue: [65-frontend--my-account-authorizations-page.md](../../issues/65-frontend--my-account-authorizations-page.md)

## Overview

Add the approving-device UI for the login-by-authorization flow: a "My account →
Authorizations" page at `#/account/authorization-requests` that lists the caller's own open
authorization requests and lets them approve (with password) or deny each, calling the
already-merged (#61) `mine`/`authorize`/`deny` backend endpoints. Entirely frontend work.

See [frontend.md](frontend.md) for the full plan.
