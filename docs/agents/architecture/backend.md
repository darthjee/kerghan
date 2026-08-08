# Architecture — Backend

**Status: precedent only.** No backend code exists yet (see `docs/agents/product.md` for what's
blocking it — the tracked-repo/label-rule data model). This page documents the target shape to
build toward, adapted from [darthjee/navi](https://github.com/darthjee/navi)'s own Express
backend, the closest existing precedent for this stack. Update it with real specifics once the
backend is actually written.

## Stack

Express + plain JavaScript (ES Modules) + Yarn, with Sequelize (model-based ORM +
`sequelize-cli` migrations) for DB access. See `AGENTS.md` and `docs/agents/contributing.md` for
the shared conventions (file naming, method order, dependency injection, complexity/line caps)
that already apply here.

## Target Express layout

```
lib/server/
├── WebServer.js               # boots Express, mounts the router
├── Router.js                  # declarative path → HandlerConfig map
├── RouteRegister.js           # wraps handlers; maps domain exceptions to HTTP status codes
└── handlers/                  # one class per route, `handle(req, res)`
```

`RouteRegister` is the piece most worth keeping close to this shape — it centralizes
exception→status-code mapping instead of scattering `try/catch` per handler, and logs every
request uniformly:

```js
// RouteRegister.js (shape)
register({ route, handler }) {
  this.#router.get(route, (req, res) => {
    try {
      handler.handle(req, res);
      Logger.debug(`${req.method} ${req.path} ${res.statusCode}`);
    } catch (e) {
      this.#handleError(e, req, res);   // ForbiddenError→403, NotFoundError→404, else 500
    }
  });
}
```

Paired with `lib/exceptions/AppError.js` — already scaffolded in this repo — a one-class
exception base every custom error extends, auto-naming itself from the subclass:

```js
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

## Serializers

Given the product's "aggregation-friendly, not just CRUD" requirement (see
`docs/agents/product.md`), a serializer class per view shape is a direct fit — e.g. an
`IssueListSerializer` vs. `IssueDetailSerializer`/`AttentionSummarySerializer` split, mirroring
Navi's `lib/serializers/` (plain-object view classes turning models into JSON responses). Not
built yet.

## Code style not already covered by `docs/agents/contributing.md`

The backend's own `eslint.config.mjs` doesn't exist yet. Once written, it should match
`frontend/eslint.config.mjs`'s complexity/line caps (max complexity 10, max 300 lines/file, max
nesting depth 4) plus these Node-specific rules carried over from Navi's own config:

- ES Modules only (`"type": "module"`, `import`/`export`, `.js` extensions required on every
  import path) — no CommonJS.
- Import order enforced: alphabetized, grouped `builtin → external → internal → local`
  (`eslint-plugin-import`'s `import/order`).
- `no-unused-vars` (params prefixed `_` exempted); `console` limited to `.warn`/`.error`.
- `eslint-plugin-sort-class-members`: static properties → static methods → properties →
  constructor → public methods → private (`#`-prefixed) methods.
- JSDoc required on public methods/classes (`eslint-plugin-jsdoc`).

## Registries

If the backend ends up with multiple named collections-of-things-with-lookup (e.g. a registry of
label-rule evaluators), have them extend a common `NamedRegistry` base, overriding only what
varies — same pattern as Navi's `lib/registry/NamedRegistry.js`.

## When this gets built

Once a `backend` specialist agent exists (see `.claude/agents/architect.md` for why there isn't
one yet) and the first real routes/models land, replace this precedent-only page with the actual
architecture, the same way `architecture/proxy.md` and `architecture/frontend.md` document what
was actually built.
