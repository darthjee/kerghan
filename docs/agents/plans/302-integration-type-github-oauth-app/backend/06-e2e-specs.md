# End-to-end specs

Cover the routes through the real Nest pipeline (guards, pipes, interceptors), using
`tests/support/build-integrations-test-app.ts`. Extend it so a test can build the app with the
type enabled (fake client id and secret, `FRONTEND_BASE_URL`) or disabled. Follow the existing
`integrations.controller.*.e2e-spec.ts` files.

- **Happy path:**
  - `start` (create) → `authorizeUrl`;
  - the fake exchange plus `GET /user` with `repo`;
  - `callback` → **201**, with an `active` row, a `gho_…` hint, login, scopes, `clientId` and
    `expiresAt: null`;
  - `start` (replace) + `callback` → **200**, and the previous token is revoked.
- **State:** replay, expired, another user's and wrong-secret states → the same 400
  `INTEGRATION_REDIRECT_STATE_INVALID`, with no GitHub call and no cool-off count. Two parallel
  callbacks with one `state` → a single code exchange.
- **Error mapping on callback:**
  - `bad_verification_code` and a 401 on `GET /user` → 422 `INTEGRATION_CREDENTIAL_INVALID`
    (counted);
  - no `repo` → 422 `INTEGRATION_INSUFFICIENT_PERMISSIONS` (counted, new token revoked);
  - other exchange errors → 502 (not counted);
  - rate limit → 503 with `Retry-After`;
  - 5xx and network errors → 502.
- **Disabled:** both routes → 404; `types.json` omits `oauth_app`; an existing `oauth_app` row can
  still be renamed, tested and deleted, and its delete makes no GitHub call.
- **Generic routes:** `POST /integrations.json` and `/:uuid/credential.json` with `oauth_app` →
  400 `INTEGRATION_FLOW_UNSUPPORTED`.
- **Delete:** calls `DELETE /applications/{client_id}/token` for that token only. A failing
  revocation still deletes the row.
- **Access:** unauthenticated → 401. Another user's `integrationId` → 404. An admin gets no
  access to another user's flow.
- **Caching and CSRF:** both routes send `X-Skip-Cache` and `Cache-Control: no-store`. A
  cross-site `POST` → 403. Extend `integrations.controller.skip-cache.e2e-spec.ts` and
  `.csrf.e2e-spec.ts`, or add OAuth equivalents.
- **Canaries everywhere:** no token, code, `state` secret or client secret in logs, error bodies
  or responses (other than `state` inside `authorizeUrl`).

## Files to Change

- `backend/src/integrations/tests/support/build-integrations-test-app.ts` — enabled and disabled OAuth config.
- `backend/src/integrations/tests/oauth-app.controller.e2e-spec.ts` — new: flow, errors and disabled behaviour.
- `backend/src/integrations/tests/integrations.controller.skip-cache.e2e-spec.ts` — the new routes.
- `backend/src/integrations/tests/integrations.controller.csrf.e2e-spec.ts` — the new routes.
- `backend/src/integrations/tests/integrations.controller.test-delete.e2e-spec.ts` — `oauth_app` delete and revocation.
