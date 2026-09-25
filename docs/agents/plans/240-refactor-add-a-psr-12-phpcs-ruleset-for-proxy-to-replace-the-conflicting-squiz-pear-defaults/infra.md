# Infra Plan: Refactor: Add a PSR-12 PHPCS ruleset for proxy/ to replace the conflicting Squiz/PEAR defaults

Main plan: [plan.md](plan.md)

## Shared contracts

This agent **produces** the `proxy_lint` service exactly as defined in [plan.md](plan.md#shared-contracts): image `darthjee/tent-test:0.10.4` (same tag as `proxy_tests`), read-only mounts `./phpcs.xml:/repo/phpcs.xml` and `./proxy:/repo/proxy`, and command `vendor/bin/phpcs --standard=/repo/phpcs.xml`.

It **relies on** the proxy agent creating `phpcs.xml` at the repository root.

## Implementation Steps

### Step 1 — Add the `proxy_lint` service

In `docker-compose.yml`, add the `proxy_lint` service right after `proxy_tests`, with a short comment: "PSR-12 PHPCS check for proxy/ (ruleset: root phpcs.xml; the same file Codacy reads)". Leave `proxy_tests` and `.circleci/config.yml` unchanged, since the issue explicitly rules out a CI step. Add the new service to the services table in `.claude/agents/infra.md`.

Once the proxy agent's `phpcs.xml` exists, run `docker-compose run --rm proxy_lint` to check that it runs `phpcs` and picks up the ruleset. It should report nothing after proxy's fixes land. It will report the 7 known errors if run before them.

## Files to Change

- `docker-compose.yml`: add the `proxy_lint` service.
- `.claude/agents/infra.md`: add a `proxy_lint` row to the services table.

## CI Checks

- `docker-compose.yml`: no CI job runs it. Verify with `docker-compose config --quiet` and `docker-compose run --rm proxy_lint`.

## Notes

- On arm64 hosts the `darthjee/tent-test` image runs under amd64 emulation and prints a platform warning, which is harmless. Do not add `platform:` just for this service; keep it consistent with `proxy_tests`.
