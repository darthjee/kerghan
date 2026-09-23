# Frontend Plan: Refactor: Guard file reads in the spec JSX loader

Main plan: [plan.md](plan.md)

## Overview
Collapse the three `readFileSync` calls in the Jasmine ESM loader into one exported `readSource(url)` helper. The helper refuses any path outside the frontend project root. Cover it with a new spec.

## Context
Codacy flags `security/detect-non-literal-fs-filename` (High) at `frontend/specs/support/jsx-loader.mjs:42` (`loadJsx`) and `:120` (the `import.meta.env` shim branch). A third read with the same shape is at `:90` (the `?raw` branch). The paths come from module URLs that Node resolved, but nothing enforces that they stay inside the project. The loader is wired through `NODE_OPTIONS='--loader ./specs/support/jsx-loader.mjs'` in the `test` and `coverage` scripts of `frontend/package.json`.

## Implementation Steps

### Step 1 — Add `readSource` and route all reads through it
In `frontend/specs/support/jsx-loader.mjs`:
- Import `path` (`import path from 'path';`).
- Add a module-level constant for the frontend root, derived from the loader's own location:
  `const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');`
  Export it so the spec can build paths relative to it.
- Add an exported, JSDoc-documented `readSource(url)` that:
  1. converts `url` with `fileURLToPath` and normalizes it with `path.resolve`;
  2. throws `new Error(\`Refusing to read outside the frontend root: ${filePath}\`)` unless `filePath.startsWith(FRONTEND_ROOT + path.sep)`. Appending the separator stops a sibling such as `frontend-other/` from passing the prefix check;
  3. returns `{ filePath, source: readFileSync(filePath, 'utf-8') }`. `loadJsx` needs `filePath` for Babel's `filename`, and the shim branch passes it to `shimImportMetaEnv`.
- Update the callers:
  - `loadJsx` takes the URL (not a path) and gets `filePath`/`source` from `readSource(url)`. `load` calls `loadJsx(url)`.
  - The `?raw` branch calls `readSource(url.slice(0, -'?raw'.length))`.
  - The `.js` shim branch calls `readSource(bareUrl)` and passes the result to `shimImportMetaEnv`.
- Update the JSDoc on `loadJsx`, since its parameter changes from a path to a URL.
- `readFileSync` must be called only inside `readSource`. Behaviour for in-root files must not change.

Node ignores extra exports from a `--loader` module; it only looks up `resolve`/`load`/`initialize`. That makes exporting `readSource` and `FRONTEND_ROOT` safe.

### Step 2 — Spec for `readSource`
Add `frontend/specs/support/jsxLoaderSpec.js`, matching the style of `fakeWindowSpec.js`. The file name matches the existing `specs/**/*[sS]pec.js` glob. Import `readSource` and `FRONTEND_ROOT` from `./jsx-loader.mjs`, and use `pathToFileURL` from `url` to build URLs. Cases:
- reads a file inside the root and returns its contents and resolved `filePath` (use `package.json` under `FRONTEND_ROOT`, or the spec file itself via `import.meta.url`);
- throws for a `..` traversal that leaves the root (e.g. `path.join(FRONTEND_ROOT, '..', 'outside.js')`);
- throws for a sibling path that shares the root's prefix (`` `${FRONTEND_ROOT}-other/file.js` ``). Build it from `FRONTEND_ROOT` instead of hardcoding `frontend`, because the container may mount the project under another name;
- throws for an absolute path elsewhere (e.g. `/etc/hosts`).

The rejection cases throw before any filesystem access, so the target files do not need to exist.

## Files to Change
- `frontend/specs/support/jsx-loader.mjs` — add `FRONTEND_ROOT` and `readSource`, and route the three reads through `readSource`.
- `frontend/specs/support/jsxLoaderSpec.js` — new spec for `readSource`.

## CI Checks
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn coverage` (CI job: `jasmine`)

## Notes
- Run tooling only through `docker-compose`, never on the host.
- If Codacy still reports the single `readFileSync` call inside `readSource`, leave it and note it in the PR. Do not add a `security/detect-non-literal-fs-filename` stub or an `eslint-disable` comment for it; the issue explicitly asks to leave it.
- Run the full suite, not only the new spec. Every spec goes through the loader, so a regression in the `.jsx`, `?raw` or shim paths shows up there. No `?raw` imports exist in `assets/` today, so that branch is only exercised indirectly.
