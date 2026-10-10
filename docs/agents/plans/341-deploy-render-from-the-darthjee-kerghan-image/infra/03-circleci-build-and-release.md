# Gate build-and-release on release-kerghan

- In the `build-and-release` workflow, replace the `release-production_kerghan-base` and
  `release-production_kerghan-base-arm64` requirements with `release-kerghan` (the production-base
  jobs stay; `release-kerghan` still requires them, so the order is transitive).
- Remove the `# Not required by anything yet: #341 ...` comment above the `release-kerghan`
  workflow.
- In the `build-and-release` job, delete the "Update Render Deploy Branch" step, keep
  `scripts/deploy.sh deploy` (rename the step to describe the image deploy), and rewrite the job
  comment to describe deploying `darthjee/kerghan:<tag>` by `imageUrl`.
- Validate with `docker-compose run --rm circleci config validate` and `config process`.

## Files to Change

- `.circleci/config.yml` — workflow requirements, job steps and comments
