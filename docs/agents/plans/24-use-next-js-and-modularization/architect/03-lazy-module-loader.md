# LazyModuleLoader and module classification wiring

Implement the on-demand module instantiation infrastructure ward's pattern relies on, even
though the only concrete module registered against it today (Auth) is always-on, not lazy — this
step lays the plumbing so future lazy modules (tracked-repo, label-rule) plug in without
re-architecting `AppModule`.

- Wrap Nest's built-in `LazyModuleLoader` (`@nestjs/core`) in a thin
  `backend/src/core/lazy-module-loader.service.ts` documenting Kerghan's module classification
  (Core / Always-on / Lazy) and exposing a `loadOnFirstRequest(moduleRef)`-style helper that
  future lazy modules' controllers can call from a route guard/interceptor.
- Document the convention (in code comments here, expanded into prose in
  [Documentation updates](09-documentation-updates.md)) for how a future lazy module registers
  itself: it is *not* imported into `AppModule` directly; instead its controller's first route
  handler triggers `LazyModuleLoader.load()` on first hit.
- No concrete lazy module exists yet (Auth, the only module built in this issue, is always-on —
  imported directly into `AppModule`) — this step only needs a passing smoke test that
  `LazyModuleLoader.load()` successfully instantiates a trivial throwaway test module, proving
  the wiring works end to end.

## Files to Change

- `backend/src/core/lazy-module-loader.service.ts` — new, thin wrapper + module-classification
  doc comment
- `backend/src/app.module.ts` — register the service as a core, always-resident provider
