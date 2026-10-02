# Flow service, DTOs and controller

Add the two type-owned routes, with a thin controller and all logic in `OauthAppFlowService`.
Reuse the generic building blocks instead of duplicating them:

- `IntegrationStoreService`: `findOwned`, `countOwned`, `assertLabelFree`, `insertWithinCap`,
  `updateOwned`;
- `IntegrationCredentialService`: `assertNotLocked`, `validate` (atomic cool-off reservation),
  `seal`;
- `normalizeLabel` and the per-user cap from `KERGHAN_INTEGRATIONS_MAX_PER_USER`. Extract the cap
  read to a shared place, or inject it, rather than reading the env var twice;
- `decryptRow` for the previous token on replace;
- `toIntegrationResponse`, via a shared respond helper. Share it with `IntegrationsService`, or
  expose it, so `nextTestAt` is computed the same way.

**DTOs:**

- `StartOauthAppDto`: optional `label` (the generic label rules from `integration-label.ts`) and
  optional `integrationId` (UUID). The service enforces exactly one, answering
  `400 VALIDATION_FAILED` otherwise.
- `OauthAppCallbackDto`: `code` (`^[A-Za-z0-9_-]{1,255}$`) and `state` (the state pattern).
  Validation messages must not echo either value.

**`start(userId, dto)`**, in the spec's order:

1. Disabled → `404 NOT_FOUND`.
2. Exactly-one check.
3. Replace only: `findOwned(userId, integrationId)` (404). A non-`oauth_app` row →
   `INTEGRATION_FLOW_UNSUPPORTED`.
4. `assertNotLocked`.
5. Create only: cap (409) and `assertLabelFree` (409).
6. `OauthStateService.issue`.
7. Build `authorizeUrl` with `client_id`, `redirect_uri`, `scope=repo`, `state`,
   `code_challenge`, `code_challenge_method=S256`, `allow_signup=false` and
   `prompt=select_account`.

No GitHub call is made, and nothing counts toward the cool-off.

**`callback(userId, dto)`**, in the spec's order:

1. Disabled → 404.
2. `consume` the state (400 without any GitHub call).
3. Replace only: `findOwned` again (404).
4. `assertNotLocked` (423).
5. Create only: cap and label again (409).
6. `credentials.validate(userId, { strategy, secret: Secret({ code, codeVerifier }) })`, so the
   counted failures go through the same cool-off as a pasted credential.
7. Store: create → `insertWithinCap` (`active`, **201**). Replace → decrypt the previous secret,
   then `updateOwned` with `seal(...)` (**200**).
8. Replace only: best-effort revoke of the **previous** token, unless it equals the new one.

If anything fails after step 6 succeeded (label or cap race, row gone, storage error), revoke
the **new** token best-effort and rethrow. Nothing is stored or changed.

**`OauthAppController`:**

- `@Controller()` + `@CachePolicy(CacheClass.Never)`.
- `@Post('integrations/oauth_app/start.json')` with `@HttpCode(200)`.
- `@Post('integrations/oauth_app/callback.json')` answers 201 or 200: the service returns
  `{ created, integration }`, and the controller sets the status through `@Res({ passthrough: true })`.
- No `@Public()` and no `@AdminOnly()`. Owner always from `@CurrentUser().sub`.
- Make sure Nest matches these literal paths before the generic `integrations/:uuid/…` routes.
  They can't collide by shape, but add a spec.

Unit specs (`tests/oauth-app-flow.service.spec.ts`) cover every *Start* and *Callback* row of
the spec's *Required tests*:

- both or neither of `label`/`integrationId` → 400;
- disabled → 404;
- foreign or missing target → 404, even while locked out;
- non-`oauth_app` target → 400;
- cool-off → 423;
- cap or duplicate label → 409, at start and at callback, revoking the new token at callback;
- replace refreshes the row and revokes the previous token;
- a replace target deleted meanwhile → 404, and the new token is revoked;
- the `authorizeUrl` parameters, including a `code_challenge` that matches the stored verifier;
- no GitHub call at start.

## Files to Change

- `backend/src/integrations/types/oauth-app/oauth-app-flow.service.ts` — new: `start` and `callback`.
- `backend/src/integrations/types/oauth-app/oauth-app.controller.ts` — new, thin.
- `backend/src/integrations/dto/start-oauth-app.dto.ts` — new.
- `backend/src/integrations/dto/oauth-app-callback.dto.ts` — new.
- `backend/src/integrations/integrations.service.ts` — expose or extract the cap value and the respond helper for reuse (no behaviour change).
- `backend/src/integrations/integrations.module.ts` — register the controller and the flow service.
- `backend/src/integrations/tests/oauth-app-flow.service.spec.ts` — new.
