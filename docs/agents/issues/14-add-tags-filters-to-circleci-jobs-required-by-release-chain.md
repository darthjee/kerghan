# Add tags filters to CircleCI jobs required by release chain

## Context

`.circleci/config.yml`'s release chain (`build-and-release`, `upload_proxy_files`, and
`upload_fe_files`) is gated to tag pushes only, via a shared `filters: &tags_only` anchor
(`tags: only: /\d+\.\d+\.\d+/`, `branches: ignore: /.*/`). Each of these jobs `requires`
`backend_tests`, `backend_checks`, `jasmine`, and `frontend-checks`, and
`build-and-release`/`upload_proxy_files`/`upload_fe_files` additionally require
`proxy_extension_tests`.

None of `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, or
`proxy_extension_tests` currently declare a `filters` block. By CircleCI's default behavior, a
job without a `filters` block only runs on branch pushes — it is skipped entirely on tag pushes.

Since the release jobs `require` these unfiltered jobs, on a tag push those required jobs never
run, and CircleCI never satisfies the `requires` dependency. This means `build-and-release`,
`upload_proxy_files`, and `upload_fe_files` — and everything downstream of them
(`upload_extension`, `copy_proxy_configuration`, `release`) — likely never trigger on a tag push,
breaking the entire release/deploy chain.

Majora's `config.yml` avoids exactly this by applying a shared `filters: *all_tags` anchor
(`tags: only: /.*/`) to all of its equivalent jobs (`pytest_*`, `jasmine`, `checks`,
`frontend-checks`, `proxy_extension_tests`), ensuring they run on both branch and tag pushes so
that tag-gated jobs further down the workflow can find their dependencies satisfied.

## What needs to be done

- CircleCI (`.circleci/config.yml`):
  - Add a reusable `filters` anchor equivalent to Majora's `*all_tags` pattern (`tags: only:
    /.*/`, with no `branches` restriction, so both branch and tag pushes are covered).
  - Apply that anchor to the `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`,
    and `proxy_extension_tests` job invocations in the `test` workflow.
  - Verify the existing `tags_only` anchor (used by `build-and-release`, `upload_proxy_files`,
    `upload_fe_files`, `upload_extension`, `copy_proxy_configuration`, and `release`) is left
    unchanged — those jobs should remain tag-only, they just now need their prerequisite jobs to
    actually run on tag pushes too.

## Acceptance criteria

- [ ] `backend_tests`, `backend_checks`, `jasmine`, `frontend-checks`, and
      `proxy_extension_tests` all declare a `filters` block that permits execution on tag pushes
      (matching semver tags), not just branch pushes.
- [ ] `build-and-release`, `upload_proxy_files`, and `upload_fe_files` can resolve their
      `requires` dependencies on a tag push (i.e. the jobs they depend on actually ran).
- [ ] Existing branch-push behavior for `backend_tests`, `backend_checks`, `jasmine`,
      `frontend-checks`, and `proxy_extension_tests` is unchanged — they still run on every
      branch push as before.
- [ ] The tag-only filters on `build-and-release`, `upload_proxy_files`, `upload_fe_files`,
      `upload_extension`, `copy_proxy_configuration`, and `release` remain unchanged.
