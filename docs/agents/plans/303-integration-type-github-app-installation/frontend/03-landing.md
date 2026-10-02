# Landing capture
Generalize the landing capture into a path → classifier table (a `Map`), keeping
`OauthAppLanding`'s behaviour, and add the github_app classifier: read `code`, `state`,
`installation_id`, `setup_action`, `error`; `history.replaceState` to
`/#/account/integrations` **before** anything else; classify `cancelled` (`access_denied`),
`requested` (`setup_action=request`), `failed` (other error, missing code/state, bad
`setup_action`, non-positive-integer `installation_id`) or `callback` (`installationId` as a
number, `setupAction`). Wire it in `main.jsx` before render.

## Files to Change
- `frontend/assets/js/utils/oauth/GithubAppLanding.js` — new (or a shared landing table + classifier).
- `frontend/assets/js/utils/oauth/OauthAppLanding.js` — reuse the shared capture if extracted.
- `frontend/assets/js/main.jsx` — capture github_app landing.
- `frontend/specs/assets/js/utils/oauth/GithubAppLandingSpec.js` — new (replaceState first, every kind, canary).
