# Proxy Plan: Tent fallback: keep the Kerghan identity marker on the probes when the backend is down

Main plan: [plan.md](plan.md)

## Shared contracts

- **Produces** `Tent\Middlewares\ProbeFallbackMiddleware` exactly as in [plan.md contract 1](plan.md#1-tentmiddlewaresprobefallbackmiddleware-proxy-produces-every-probesphp-consumes): `502`/`504` only, probe paths only, the pinned bodies, and exactly three headers.
- **Produces** `proxy/dev_configuration/rules/probes.php` and `proxy/prod_configuration/rules/probes.php` with the shape in [contract 2](plan.md#2-rulesprobesphp-proxy-writes-dev-and-prod-standalone-writes-the-standalone-copy). The standalone agent writes a byte-identical third copy, and the end-to-end test asserts all three match.
- **Relies on** infra providing the config trees at `$KERGHAN_REPO_ROOT` (default `/kerghan`) inside `proxy_tests` ([contract 3](plan.md#3-config-tree-location-for-proxy_tests-infra-provides-the-proxy-end-to-end-test-consumes)).
- **Timeout invariant** ([contract 4](plan.md#4-timeout-invariant-proxy-and-standalone)): `timeout: 2` < diagnose's `--max-time 3`.

## Steps

- [01 — Add ProbeFallbackMiddleware with unit tests](proxy/01-probe-fallback-middleware.md)
- [02 — Add rules/probes.php to dev and prod](proxy/02-probes-rule-dev-prod.md)
- [03 — End-to-end test against the real probes.php](proxy/03-end-to-end-test.md)
- [04 — Proxy docs](proxy/04-docs.md)

## CI Checks

- `proxy/`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy/`: `docker-compose run --rm proxy_lint` (PSR-12, root `phpcs.xml`; also read by Codacy)

## Notes

- Blocked on #617: Tent must be `>= 1.4.0`. On `1.3.0` the handler never yields `502`/`504` (empty `200`), so step 03 fails. Confirm `grep '^tent=' version` before starting.
- `default_proxy` caches `2xx` into `./cache` by default (`DefaultProxyRequestHandler::build`), so `'cache' => false` is required, not cosmetic.
- PHP is not on the host: run `php -l` and the tests only through docker-compose or `docker run`.
