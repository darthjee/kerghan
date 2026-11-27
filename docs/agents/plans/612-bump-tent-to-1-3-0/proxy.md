# Proxy Plan: Bump Tent to 1.3.0

Main plan: [plan.md](plan.md)

## Shared contracts

- Relies on infra's bumped compose images (`darthjee/tent:1.3.0`, `darthjee/tent-test:1.3.0`) and CircleCI pins.
- Fills the "Security recheck" section of the PR description, one pass/fail verdict per row (contract 7).
- Owns `docs/agents/architecture/security.md`, which is **not** in `bump_tent.sh`'s list (contract 3) and moves to 1.3.0 only after the recheck.

## Steps

- [01 — Proxy suite and lint on Tent 1.3.0](proxy/01-suite-on-1-3-0.md)
- [02 — Row-3 regression test: client IP through the full chain](proxy/02-client-ip-forwarding-test.md)
- [03 — Security recheck and security.md](proxy/03-security-recheck.md)

## CI Checks

- `proxy/`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`), `docker-compose run --rm proxy_lint` (PHPCS; Codacy reads the same `phpcs.xml`), `.claude/scripts/check_proxy.sh` for the full local check.

## Notes

- `proxy_tests` does not mount `proxy/dev_configuration` or `proxy/prod_configuration`; tests under `tests/proxy` mirror the backend rule inline (see `BackendSetCookieForwardingTest`), so keep the mirrored rule in sync with both configurations.
- A defect in Tent itself found here is out of scope: report it upstream to `darthjee/tent` and block the bump; only a small extension-side workaround is in scope.
