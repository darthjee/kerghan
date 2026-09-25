# Fix the real PSR-12 violations

The ruleset currently reports 7 errors. Fix all of them so `docker-compose run --rm proxy_lint` is clean.

1. **`PSR12.Files.FileHeader` (6 files):** these need a blank line between `<?php` and the file docblock, or after the docblock where flagged. `phpcbf` can fix them automatically. Run it inside the `darthjee/tent-test:0.10.4` image (for example `docker-compose run --rm proxy_lint vendor/bin/phpcbf --standard=/repo/phpcs.xml`, after temporarily making the mounts writable, or an equivalent `docker run -v "$PWD":/repo`), or add the blank lines by hand. Files affected:
   - `proxy/dev_configuration/rules/backend.php`, `frontend.php`, `redirects.php`
   - `proxy/prod_configuration/rules/backend.php`, `redirects.php`
   - `proxy/extension/tests/bootstrap.php` (line 9)
2. **`PSR1.Classes.ClassDeclaration.MultipleClasses`:** `proxy/extension/tests/cache/DomainHashTest.php` declares a second class, `DomainHashTestRequest` (line 106). Move it, with its docblock unchanged, into its own file `proxy/extension/tests/support/DomainHashTestRequest.php` in the same `Tent\Cache\Tests` namespace. Load it with `require_once __DIR__ . '/../support/DomainHashTestRequest.php';` at the top of `DomainHashTest.php`. The file name doesn't end in `Test.php`, so PHPUnit's directory scan won't treat it as a test. Don't change its behaviour.

Then run `docker-compose run --rm proxy_tests` and check that it still passes, and that `proxy_lint` reports no violations.

## Files to Change

- `proxy/dev_configuration/rules/backend.php`, `frontend.php`, `redirects.php`: file-header blank line.
- `proxy/prod_configuration/rules/backend.php`, `redirects.php`: file-header blank line.
- `proxy/extension/tests/bootstrap.php`: file-header blank line.
- `proxy/extension/tests/cache/DomainHashTest.php`: remove the inline `DomainHashTestRequest` class and `require_once` its new file.
- `proxy/extension/tests/support/DomainHashTestRequest.php` (new): the extracted request double.
