# Integrations service, controller and module wiring

Implement `api.md`'s routes and per-action behaviour on top of steps 01–06.

## `IntegrationsService` (all business logic)

Every query is owner-scoped (`where: { uuid, userId }`). A miss → `NotFoundException` with the
same body for missing, foreign and malformed uuids. That lookup runs first on every `:uuid`
action.

- **list(userId):** every row, newest first (`created_at DESC`, `id DESC`), with no decryption.
- **show(userId, uuid)**.
- **enabledTypes()**, delegating to the registry.
- **create(userId, dto)**, checks in this order:
  1. DTO validation, including `strategy.flows.credentialPaste`, else 400
     `INTEGRATION_FLOW_UNSUPPORTED`; then `parseCredential` → `Secret`.
  2. Cool-off → 423.
  3. Cap: count by `userId` against `KERGHAN_INTEGRATIONS_MAX_PER_USER` → 409.
  4. Label uniqueness (`label_normalized`) → 409.
  5. `strategy.validate`:
     - on counted failures, `registerFailure` and then 422;
     - on transient failures, 502/503 (+ `Retry-After`), not counted.
  6. On success:
     - `reset` the cool-off;
     - generate the uuid;
     - encrypt with AAD `uuid:type`;
     - `mask`;
     - insert with `status=active`, `last_tested_at=now` and `last_test_result=success`.

  A unique-index race on `(user_id, label_normalized)` (`ER_DUP_ENTRY`) also answers 409
  `INTEGRATION_LABEL_TAKEN`.
- **rename(userId, uuid, label):**
  - Trim it and set `label_normalized`. Only the label changes.
  - A duplicate belonging to another row → 409. The same row with a different case is allowed.
- **replaceCredential(userId, uuid, dto):**
  1. Owner lookup.
  2. Flow kind and `parseCredential` for the **row's** type.
  3. Cool-off.
  4. Validate.
  5. On success, re-encrypt (fresh IV) and refresh the hint, `github_login`, `expires_at` and
     metadata. Set `status=active`, `status_reason=null` and the test fields.
  6. On failure, change nothing on the row (counted failures still register).
- **test(userId, uuid):**
  1. Owner lookup.
  2. Cooldown claim, else 429 + `Retry-After`.
  3. Decrypt and validate the payload. If that fails, set `status=undecryptable` and
     `last_test_result=undecryptable`, and answer 200 with no GitHub call.
  4. `strategy.test`:
     - `active` → refresh the fields, `status_reason=null`, result `success`;
     - `invalid`/`expired` → status plus reason (the reason only with `invalid`), result
       `rejected`, 200;
     - transient → result `transient_error`, status unchanged, then 502/503.

  A stored-`undecryptable` row whose key id matches again is decrypted and tested normally.
- **delete(userId, uuid):**
  1. Owner lookup.
  2. Decrypt, or `null` on failure.
  3. `strategy.onDelete`, in a try/catch: log safe fields, never block.
  4. Delete the row.

## Response serializer

Build the response from an **explicit allowlist** (`api.md#integration-response`): `id` = uuid,
camelCase fields and ISO dates.

- The internal `id`, `userId` and every `secret_*` field are never included.
- Reported status:
  - `undecryptable` when the key id doesn't match the configured one;
  - `expired` when the stored status is `active` and `expiresAt < now`;
  - otherwise as stored.
- `secretHint` is `null` when the reported status is `undecryptable`.

## DTOs

Use `class-validator`:
- `CreateIntegrationDto` (`label`, `provider` in `['github']`, `type` in the enum, `credential`
  an object);
- `RenameIntegrationDto`;
- `ReplaceCredentialDto`.

Validation messages never echo values. The label is trimmed, 1–100 characters after trimming.
Unknown top-level fields are stripped by the global `whitelist`.

## `IntegrationsController` (thin)

- `@Controller('integrations')`, with `@CachePolicy(CacheClass.Never)` at controller level.
- No `@Public()` and no `@AdminOnly()`.
- The user comes from `@CurrentUser()`.
- Routes and statuses exactly as in `api.md`:
  - `POST mine.json`, `POST :uuid/show.json`, `POST types.json`, `POST .json`;
  - `PATCH :uuid.json`;
  - `POST :uuid/credential.json`, `POST :uuid/test.json`;
  - `DELETE :uuid.json` → 204.
- Check route ordering, so `types.json` / `mine.json` aren't captured by `:uuid`. Check how
  existing controllers declare `.json` paths (e.g. `auth.controller.ts`) and match it.

## Module

- `IntegrationsModule`: `TypeOrmModule.forFeature([Integration, IntegrationCredentialLockout])`.
- Providers: the key provider, encryption, GitHub client, registry, PAT strategy, guards and the
  service.
- Exports: nothing yet.
- Import it in `AppModule` as an always-on module, with a JSDoc noting the classification and
  the physical-FK exception.
- Add `IntegrationsController` to `KNOWN_CONTROLLERS` in
  `core/tests/cache-policy.coverage.spec.ts`.

## Service specs

Cover:
- `model.md`'s status lifecycle and edge cases, plus `api.md`'s check orders: cool-off, cap and
  duplicate label make no GitHub call;
- expiry on read;
- the canary absent from logger spies, thrown errors and returned objects.

## Files to Change
- `backend/src/integrations/integrations.service.ts`: new.
- `backend/src/integrations/integration-response.ts`: new serializer.
- `backend/src/integrations/dto/create-integration.dto.ts`, `rename-integration.dto.ts`, `replace-credential.dto.ts`: new.
- `backend/src/integrations/integrations.controller.ts`: new.
- `backend/src/integrations/integrations.module.ts`: new.
- `backend/src/app.module.ts`: import `IntegrationsModule`.
- `backend/src/core/tests/cache-policy.coverage.spec.ts`: register the new controller.
- `backend/src/core/tests/app.module.spec.ts`: update if it asserts the imported modules.
- `backend/src/integrations/tests/integrations.service.spec.ts` (split per action if large), `integrations.controller.spec.ts`: new.
