# DTOs, guard, controller and module wiring
DTOs: start (`label` xor `integrationId`, `mode` `IsIn(['install','connect'])`), callback (`code`
`[A-Za-z0-9_-]{1,255}`, `state` pattern, `installationId` `IsInt`/`Min(1)`/`Max(MAX_SAFE_INTEGER)`,
`setupAction` `install|update` required iff `installationId`), select (`state`, `installationId`).
`GithubAppEnabledGuard` (404 when disabled, before validation). Thin `GithubAppController` with
`@CachePolicy(CacheClass.Never)`, `@Res({ passthrough: true })` for 201/200, owner from
`req.user.sub` only. Wire entity, config provider, services, strategy and controller in
`integrations.module.ts`.

## Files to Change
- `backend/src/integrations/dto/start-github-app.dto.ts`, `backend/src/integrations/dto/github-app-callback.dto.ts`, `backend/src/integrations/dto/github-app-select.dto.ts` — new.
- `backend/src/integrations/types/github-app/github-app-enabled.guard.ts` — new.
- `backend/src/integrations/types/github-app/github-app.controller.ts` — new.
- `backend/src/integrations/integrations.module.ts` — wiring.
