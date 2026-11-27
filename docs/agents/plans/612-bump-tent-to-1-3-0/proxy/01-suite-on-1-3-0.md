# Proxy suite and lint on Tent 1.3.0

Once infra has bumped the compose images, run `docker-compose run --rm proxy_tests` and `docker-compose run --rm proxy_lint` against `darthjee/tent-test:1.3.0`. Fix any break in the extension in this PR: the classes under `proxy/extension/lib/` extend Tent's `Tent\Middlewares` / `Tent\Cache` namespaces and are wired through `proxy/extension/loader.php`, and 1.0.3 → 1.3.0 is a three-minor jump against those interfaces. Also bring up the dev stack (`docker-compose up kerghan_proxy`) and confirm a `*.json` request reaches the backend and the frontend is served; fix `proxy/dev_configuration` / `proxy/prod_configuration` if their rule format changed (keep the two in step).

Update the comment in `tests/proxy/BackendSetCookieForwardingTest.php` that names "Tent 1.0.3" as the version sending cookies with replace = false, if 1.3.0 still behaves that way.

## Files to Change

- `proxy/extension/lib/**`, `proxy/extension/loader.php` — only if 1.3.0 breaks them.
- `proxy/dev_configuration/**`, `proxy/prod_configuration/**` — only if the rule format changed.
- `proxy/extension/tests/proxy/BackendSetCookieForwardingTest.php` — version mention in the docblock.
