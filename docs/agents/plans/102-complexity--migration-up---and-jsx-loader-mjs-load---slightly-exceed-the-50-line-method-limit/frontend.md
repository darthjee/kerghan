# Frontend Plan: Complexity: migration up() and jsx-loader.mjs load() slightly exceed the 50-line method limit

Main plan: [plan.md](plan.md)

## Shared contracts

None — this fix is fully contained within the loader file.

## Implementation Steps

### Step 1 — Shrink `load()` in `jsx-loader.mjs`

`frontend/specs/support/jsx-loader.mjs:44`'s `load()` is 55 lines: a chain of
five independent `if` branches (`?raw` text imports, `.jsx` Babel transform,
CSS/SCSS stubs, image stubs, and the `import.meta.env` shim for plain `.js`
modules). Extract at least two of these branches — the `.jsx`-transform
branch and the `import.meta.env`-shim branch are the largest — into private
helper functions in the same file (e.g. `loadJsx(filePath)` and
`shimImportMetaEnv(filePath, source)`), each returning the same
`{ format, source, shortCircuit }` shape `load()` already returns inline.
`load()` itself should become a short sequence of early-return branches
calling these helpers. Do not change the resolve hook, the branch order, or
any of the transform behavior (Babel options, CSS/image stub shapes, the
`import.meta.env` shim logic).

## Files to Change

- `frontend/specs/support/jsx-loader.mjs` — extract one or more of `load()`'s
  branches into private helper functions, reducing `load()` to ≤ 50 lines
  with identical module-loading behavior.

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- This file is the Jasmine spec loader itself, so there's no dedicated spec
  file exercising it directly — verify it by running the full frontend
  Jasmine suite (`yarn test`) and confirming JSX specs, `?raw` imports, and
  CSS/image-stubbed specs all still pass.
