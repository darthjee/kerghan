# Infra Plan: Tent fallback: keep the Kerghan identity marker on the probes when the backend is down

Main plan: [plan.md](plan.md)

## Shared contracts

- **Provides** the three Tent configuration trees to `ProbeFallbackTest` ([plan.md contract 3](plan.md#3-config-tree-location-for-proxy_tests-infra-provides-the-proxy-end-to-end-test-consumes)), at `$KERGHAN_REPO_ROOT` (default `/kerghan` when unset):
  - `$KERGHAN_REPO_ROOT/proxy/dev_configuration`
  - `$KERGHAN_REPO_ROOT/proxy/prod_configuration`
  - `$KERGHAN_REPO_ROOT/standalone/vault/tent/configuration`

## Implementation Steps

### Step 1 — docker-compose `proxy_tests` mounts

Add three **read-only** volumes to the `proxy_tests` service, keeping the existing `./proxy/extension` mount:

```yaml
      - ./proxy/dev_configuration:/kerghan/proxy/dev_configuration:ro
      - ./proxy/prod_configuration:/kerghan/proxy/prod_configuration:ro
      - ./standalone/vault/tent/configuration:/kerghan/standalone/vault/tent/configuration:ro
```

Leave `KERGHAN_REPO_ROOT` unset so the test default (`/kerghan`) applies. Add a short comment that `ProbeFallbackTest` loads the real `rules/probes.php` from each tree (#613).

### Step 2 — CircleCI `proxy_extension_tests`

The job already checks the repo out to `/tmp/checkout`. Set `KERGHAN_REPO_ROOT: /tmp/checkout` on the job's `Tests` step (an `environment:` block), so the test finds the trees there. Nothing is copied. Update the job's entry in `docs/agents/architecture/infra/ci-jobs.md` to mention that the tests also read the three configuration trees from the checkout.

## Files to Change

- `docker-compose.yml`: three read-only mounts on `proxy_tests`.
- `.circleci/config.yml`: `KERGHAN_REPO_ROOT=/tmp/checkout` on `proxy_extension_tests`.
- `docs/agents/architecture/infra/ci-jobs.md`: note the config-tree dependency of `proxy_extension_tests`.

## CI Checks

- `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`), once the proxy agent's `ProbeFallbackTest` exists.
- `docker-compose run --rm scripts_tests`: `bump_tent.sh --check` still passes (the Tent pin lines are untouched).

## Notes

- Don't touch the `tent=` pin or the Tent image tags: that's #617.
