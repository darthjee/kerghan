# Proxy Plan: Refactor: Add a PSR-12 PHPCS ruleset for proxy/ to replace the conflicting Squiz/PEAR defaults

Main plan: [plan.md](plan.md)

## Shared contracts

This agent **produces** the root `phpcs.xml` exactly as defined in [plan.md](plan.md#shared-contracts): `PSR12`, `extensions=php`, and `<file>` entries `proxy/extension/lib`, `proxy/extension/tests`, `proxy/dev_configuration` and `proxy/prod_configuration`, relative to the repository root.

It **relies on** the infra agent adding the `proxy_lint` service (`docker-compose run --rm proxy_lint`), which mounts that file and `proxy/` and runs `phpcs` with it.

## Steps

- [01 — Add the root PSR-12 ruleset](proxy/01-add-psr12-ruleset.md)
- [02 — Fix the real PSR-12 violations](proxy/02-fix-psr12-violations.md)
- [03 — Document ownership and the lint command](proxy/03-document-lint.md)

## CI Checks

- `proxy/`: `docker-compose run --rm proxy_tests` (CI job: `proxy_extension_tests`)
- `proxy/`: `docker-compose run --rm proxy_lint` (local only, with no CI job by design)

## Notes

- PHP is not installed on the host. Run `phpcs`/`phpcbf` only inside `darthjee/tent-test:0.10.4`, through `docker-compose run --rm proxy_lint` or an equivalent `docker run` that mounts the repo, never on the host.
- Codacy may only honour `phpcs.xml` once "use configuration file" is enabled for PHP_CodeSniffer in the Codacy UI (Code patterns). Check Codacy's PHP_CodeSniffer docs for the accepted file names and location (repository root). The PR description must spell out any manual Codacy UI step. If Codacy ignores the file, it must also name the fallback: turning off the Squiz/PEAR patterns in the UI.
- `proxy/extension/loader.php` and `proxy/*/locals.php` are outside the four paths the issue names. `loader.php` already passes PSR-12. Don't widen the scope.
