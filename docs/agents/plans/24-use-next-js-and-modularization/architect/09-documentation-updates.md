# Documentation updates

Bring the rest of the project documentation in line with the new backend stack, per the issue's
"Documentation updates required" checklist (the `.claude/agents/backend.md` and
`.claude/agents/architect.md` items are covered by
[Step 08](08-introduce-backend-agent.md) instead).

- `AGENTS.md` — update the "Backend" stack section: Express → NestJS, Sequelize → TypeORM,
  Jasmine + c8 → Jest.
- `docs/agents/architecture/backend.md` — replace the current "precedent only" page with the
  actual NestJS architecture: module structure, `main.ts`/`app.module.ts` layout, TypeORM data
  source, JWT Guard.
- `docs/agents/architecture/` — new page documenting the modular pattern itself: module
  classification (Core/Always-on/Lazy), `LazyModuleLoader` usage, the hybrid
  DI/event-driven inter-module communication rules, and the database strategy (shared MySQL,
  per-module table prefixes, no cross-module JOINs/physical FKs).
- `docs/agents/modules/auth.md` — new, Auth module documentation: routes, entities, JWT/refresh
  flow, `user.registered` event.
- `docs/agents/contributing.md` — update the backend "Code Organization" section: file naming,
  method order, and ESLint rules for the new NestJS/TypeScript code (replacing the
  Express/Sequelize-era conventions), and confirm the CI Checks table's backend row still lists
  the right local commands (should be unchanged — see this plan's shared contract with `infra`).

## Files to Change

- `AGENTS.md` — Backend stack section
- `docs/agents/architecture/backend.md` — rewritten
- `docs/agents/architecture/` — new modular-pattern page
- `docs/agents/modules/auth.md` — new
- `docs/agents/contributing.md` — Code Organization + CI Checks table review
