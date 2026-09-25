# Plan: Refactor: Add a PSR-12 PHPCS ruleset for proxy/ to replace the conflicting Squiz/PEAR defaults

Issue: [240-refactor-add-a-psr-12-phpcs-ruleset-for-proxy-to-replace-the-conflicting-squiz-pear-defaults.md](../../issues/240-refactor-add-a-psr-12-phpcs-ruleset-for-proxy-to-replace-the-conflicting-squiz-pear-defaults.md)

## Overview

Add a root `phpcs.xml` that applies `PSR12` to the proxy PHP code, so Codacy stops using its default Squiz/PEAR standards (about 217 findings that contradict PSR-12). Fix the few real PSR-12 violations. Add a `proxy_lint` docker-compose service so the check can run locally. The proxy agent owns the ruleset, the fixes and the docs. The infra agent adds the service, because `docker-compose.yml` is in its scope.

A local run of `phpcs --standard=PSR12` in `darthjee/tent-test:0.10.4` across the four paths currently reports **7 errors in 7 files**:

- 6 × `PSR12.Files.FileHeader` ("Header blocks must be separated by a single blank line"), which `phpcbf` can fix
- 1 × `PSR1.Classes.ClassDeclaration.MultipleClasses` in `proxy/extension/tests/cache/DomainHashTest.php` (the `DomainHashTestRequest` double at line 106)

## Agents involved

- [proxy](proxy.md)
- [infra](infra.md)

## Shared contracts

**Ruleset file** (produced by proxy, consumed by infra's service):

- Path: `phpcs.xml` at the repository root.
- `<file>` entries are relative to the repository root. PHPCS resolves relative `<file>` paths against the ruleset's own directory:
  - `proxy/extension/lib`
  - `proxy/extension/tests`
  - `proxy/dev_configuration`
  - `proxy/prod_configuration`
- `<rule ref="PSR12"/>` and `<arg name="extensions" value="php"/>`.

**`proxy_lint` service** (produced by infra, documented and used by proxy):

```yaml
  proxy_lint:
    image: darthjee/tent-test:0.10.4
    volumes:
      - ./phpcs.xml:/repo/phpcs.xml:ro
      - ./proxy:/repo/proxy:ro
    command: vendor/bin/phpcs --standard=/repo/phpcs.xml
```

- Invocation: `docker-compose run --rm proxy_lint`. It exits 0 when clean and non-zero when there are violations.
- The image's working directory is `/home/app/app`, where `vendor/bin/phpcs` lives. The image tag must stay in step with `proxy_tests`.
- The service sits right after `proxy_tests`, and `proxy_tests` stays unchanged. No CircleCI step is added.
