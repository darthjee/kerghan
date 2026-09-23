# Issue: Refactor: Guard file reads in the spec JSX loader

## Description
The custom ESM loader used to run the frontend Jasmine specs (`frontend/specs/support/jsx-loader.mjs`, wired via `NODE_OPTIONS='--loader ...'` in the `test` and `coverage` scripts) reads source files with non-literal paths.

## Problem
Codacy reports `security/detect-non-literal-fs-filename` (High) at `frontend/specs/support/jsx-loader.mjs:42` (`loadJsx`) and `:120` (the `import.meta.env` shim branch) — `readFileSync` with a computed argument. A third read with the same shape exists at `:90` (the `?raw` branch). The paths come from module URLs resolved by Node, but nothing states or enforces that they stay inside the project.

## Expected Behavior
- JSX specs load and run exactly as before (`.jsx` transform, `?raw` imports, `import.meta.env` shim).
- All filesystem reads in the loader go through a single helper that refuses paths outside the frontend project root.

## Solution
Add one `readSource(url)` helper in `jsx-loader.mjs` that:
1. converts the URL with `fileURLToPath`;
2. resolves it with `path.resolve` and asserts it stays inside the frontend project root (derived from `import.meta.url`), using a prefix check against the root plus `path.sep`;
3. only then calls `readFileSync(filePath, 'utf-8')`.

When the resolved path falls outside the root, the helper throws an error whose message names the rejected path. It does not fall back to `nextLoad`.

Route all three current reads (lines 42, 90 and 120) through it, so the loader has one reviewed call site instead of three. If Codacy still reports that single site, leave it and note it in the PR.

Export `readSource` and add a Jasmine spec under `frontend/specs/support/`. The spec covers:
- reading a file inside the frontend root;
- throwing for a path outside the root, including a `..` traversal and a sibling directory that shares the root's name prefix (e.g. `frontend-other/`).

## Benefits
Turns an implicit trust assumption into an explicit check and reduces the findings to at most one.

## Verification
- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
