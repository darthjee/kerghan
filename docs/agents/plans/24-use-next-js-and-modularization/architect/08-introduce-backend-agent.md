# Introduce the `backend` specialist agent

Now that the backend stack is settled (NestJS + TypeORM + MySQL, modular architecture), create
the specialist agent `AGENTS.md`/`.claude/agents/architect.md` have been deferring, and retire
the architect's interim ownership note for `backend/`.

- Create `.claude/agents/backend.md`, scoped to `backend/`, following the shape of the other
  specialist agents (`frontend`, `infra`, `proxy`, `cache` — read one as a template for
  frontmatter/tone). Document: NestJS module structure conventions (from this plan's Steps
  01–06), TypeORM entity/migration conventions, the Core/Always-on/Lazy classification, the
  hybrid DI/event-driven inter-module communication pattern, and DI-only dependency rules (per
  `docs/agents/contributing.md`).
- Update `.claude/agents/architect.md`'s specialist-agent table: change the `backend` row from
  "🚧 not yet written" to the real scope description, and remove the paragraph explaining there's
  no backend agent yet / that the architect owns `backend/` in the interim.
- Update `AGENTS.md`'s "Specialist agents" section: add `backend` to the roster list.

## Files to Change

- `.claude/agents/backend.md` — new specialist agent definition
- `.claude/agents/architect.md` — update the specialist-agent table, remove the interim-ownership
  note
- `AGENTS.md` — add `backend` to the "Specialist agents" roster
