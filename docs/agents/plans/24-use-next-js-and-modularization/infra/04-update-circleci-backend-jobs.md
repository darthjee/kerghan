# Update CircleCI backend jobs for the TS build + Jest

`.circleci/config.yml`'s `backend_tests` and `backend_checks` jobs flatten `backend/` to the repo
root (`rm frontend -rf; cp backend/* ./ -r; rm backend -rf`) before running `yarn install` and
`npm run coverage`/`npm run lint`. The command names stay the same (per this plan's shared
contract with `architect`), but a build step needs to be added, and the base image
(`darthjee/circleci_kerghan-base:0.1.0`) needs to match whatever [Step 01](01-update-dockerfiles-for-ts-build.md)
changes about the backend base image (TypeScript toolchain availability).

- Add a `Build` step (`npm run build`) to `backend_tests` between `Yarn install` and `Tests`, so
  `npm run coverage` (Jest) runs against compiled output if the chosen Jest config needs it (Jest
  with `ts-jest` typically doesn't need a separate build step — confirm which approach
  `architect`'s [Step 07](../architect/07-migrate-tests-to-jest.md) picked before adding this
  step; skip it if `ts-jest`/SWC transforms TS on the fly).
- `backend_checks`'s lint step (`npm run lint`) needs ESLint's flat config
  (`backend/eslint.config.mjs`) updated for TypeScript (new parser/plugin deps) — that's
  `architect`'s change; this job's command (`npm run lint`) doesn't need to change here.
- Bump `darthjee/circleci_kerghan-base:0.1.0` to whatever new tag
  [Step 01](01-update-dockerfiles-for-ts-build.md) produces once the TS toolchain is added to
  that base image, in both `backend_tests` and `backend_checks`.
- Verify the Codacy coverage upload step (`bash <(curl -Ls https://coverage.codacy.com/get.sh)
  report --partial -r coverage/lcov.info`) still finds `coverage/lcov.info` at the same path —
  Jest's `--coverage` with an `lcov` reporter (matching `c8`'s current config) should produce it
  in the same place; confirm against `architect`'s Jest config in
  [Step 07](../architect/07-migrate-tests-to-jest.md).

## Files to Change

- `.circleci/config.yml` — `backend_tests`/`backend_checks` jobs: base image tag, optional build
  step, verify coverage output path unchanged
