# Write `integrations/ui.md`

Create `docs/agents/specs/integrations/ui.md` (the UI shell; per-type forms/flows live in the
type specs):

- **Menu item** — an *Integrations* item in the "My account" dropdown
  (`frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`), shown only when
  logged in; route for the page (e.g. `#/integrations`, consistent with the existing hash
  routing and Tent's `/path → /#/path` redirect).
- **Page** — list of the user's integrations from `POST /integrations/mine.json`, empty state,
  error state.
- **List columns** — label, type, GitHub login/account, status (with `statusReason` shown as
  text), secret hint, expiry (with "expiring soon" flag for `expiresAt` within **7 days**), last
  tested (time + outcome). Optional hint when two integrations share the same GitHub login.
- **Actions** — add (type picker → per-type flow: credential-paste form or redirect start),
  rename, replace credential, remove (with confirmation), test connection (button disabled
  until the cooldown ends, using `lastTestedAt` and/or `Retry-After`). Each action's error
  display uses the standard error format codes from `api.md`.
- **Type picker** — lists `pat`, `oauth_app`, `github_app`; each type contributes its own
  form/flow via its type spec; types not yet implemented are hidden.
- **Credential input rules** — `type="password"`, `autocomplete="off"`, cleared from component
  state after submit (success or failure), never logged to `console`, written to storage or put
  in the URL.
- **Required tests** section — menu item, list rendering (each status, expiring soon), each
  action, disabled test button during cooldown, password input attributes, state cleared after
  submit, canary credential never in `console`/storage/URL (Jasmine specs, existing
  conventions).

## Files to Change

- `docs/agents/specs/integrations/ui.md` — new UI spec.
