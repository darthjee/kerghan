# `release-kerghan` CircleCI job

Add a job and wire it into the `test` workflow.

Job definition (under `jobs:`, next to `release-image`, with a short comment in the same style):

```yaml
  # Multi-arch (amd64 + arm64) publish of the production backend image darthjee/kerghan, as one
  # manifest under the app's semver tag and `latest` (see docs/agents/specs/standalone/images.md).
  release-kerghan:
    machine: true
    steps:
      - checkout
      - run:
          name: Release darthjee/kerghan
          command: bin/release_kerghan.sh
```

Workflow entry:

```yaml
      - release-kerghan:
          requires:
            - backend_tests
            - backend_checks
            - jasmine
            - frontend-checks
            - proxy_extension_tests
            - release-production_kerghan-base
            - release-production_kerghan-base-arm64
          filters: *tags_only
```

Place it so the `*tags_only` alias is already defined above it (the anchor is set on
`build-and-release`), e.g. right after `build-and-release`. Do **not** change `build-and-release`'s
`requires:`: that is #341.

If `machine: true`'s default image has a Docker version without buildx, pin a recent machine image
(`machine: image: ubuntu-2204:current`) for this job only.

## Files to Change
- `.circleci/config.yml` — new `release-kerghan` job and its `test` workflow entry (tag-only, requires tests + production base releases).
