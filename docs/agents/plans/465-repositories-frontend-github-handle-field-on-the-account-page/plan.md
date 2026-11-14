# Plan: Repositories: Frontend — GitHub handle field on the Account page

Issue: [465-repositories-frontend-github-handle-field-on-the-account-page.md](../../issues/465-repositories-frontend-github-handle-field-on-the-account-page.md)

## Overview
Add a separate GitHub handle section to the My Account page: it is prefilled from `POST /auth/account/mine.json` and saved through a handle-only `PATCH /auth/account.json`, with client-side validation. Frontend only.

See [frontend.md](frontend.md) for the full plan.
