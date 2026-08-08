# Architecture — Frontend

React 19 + Vite, built and tested the same way regardless of backend language. Currently a
**tooling-only skeleton**: `App.jsx` is a placeholder shell, no real components, client, or
router exist yet — those get built once there's a backend API to consume.

## Stack

- React 19 (no React Bootstrap/UI kit chosen yet — Majora's is deliberately not carried over)
- Vite (dev server on port 8080, `npm run build` outputs to `dist/`, matching the
  `docker_volumes/static` bind mount)
- Jasmine + c8 (tests/coverage), driven through a custom Node ESM loader
  (`specs/support/jsx-loader.mjs`) that transforms `.jsx` via Babel, stubs image/CSS imports,
  and shims `import.meta.env` for Node-based specs
- ESLint (flat config, `eslint.config.mjs`) — 2-space indent, single quotes, semicolons
  required, max complexity 10, max 300 lines/file, JSDoc required on public API

## Directory layout (current)

```
frontend/assets/js/
  App.jsx            # placeholder shell component
  main.jsx           # entry point — mounts App into #root

frontend/specs/
  assets/js/AppSpec.js
  support/jsx-loader.mjs
```

Once real views exist, mirror Majora's shape (`components/`, `client/`, `utils/`) rather than
inventing a new one — see `frontend.md` in `.claude/agents/` for the full component-extraction
conventions to apply as it grows. Given `docs/agents/product.md`'s "aggregation-friendly, not
just CRUD" API design, expect the eventual `client/` layer to fetch pre-aggregated dashboard data
(counts, groupings, "needs attention" lists) rather than raw per-issue CRUD — plus, per
`docs/agents/flow.md`, some of that fetching happens directly against GitHub's API rather than
the backend at all.

## No Vite proxy to the backend

There is no Vite `server.proxy` config pointing at the backend — that's the Tent proxy's job
(see `architecture/proxy.md`), not Vite's. In dev, Tent forwards non-asset requests to the Vite
dev server for HMR; Vite itself never talks to the backend directly.

See `.claude/agents/frontend.md` for local dev commands, code conventions, and the JSX
extraction rules.
