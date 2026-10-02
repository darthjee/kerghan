# GitHub App flow module
Extract the generic pieces of `redirectFlow.js` (`upsert`, `reporterFor`, notices) into a shared
module and add `githubAppFlow.js`: `start({ label | integrationId, mode })` (reads
`redirectUrl`, checks the allow-list, otherwise shows an error and does not navigate),
`completeLanding()` (landing notices for cancelled/requested/failed with the spec's texts; POST
callback; on `selection` hand it to page state; on success "Connected to the GitHub App
installation on <account>"), and `select(installationId)` (POST select, clear the selection
whatever the outcome).

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/integrations/redirectShared.js` — new, extracted helpers.
- `frontend/assets/js/components/resources/accounts/pages/integrations/redirectFlow.js` — use shared helpers.
- `frontend/assets/js/components/resources/accounts/pages/integrations/githubAppFlow.js` — new.
- `frontend/specs/assets/js/components/resources/accounts/pages/integrations/githubAppFlowSpec.js` — new; `redirectFlowSpec.js` kept green.
