# Issue: Refactor: Add a PSR-12 PHPCS ruleset for proxy/ to replace the conflicting Squiz/PEAR defaults

## Description
Codacy runs PHP_CodeSniffer on the proxy PHP code with its default Squiz/PEAR standards. Those standards contradict PSR-12, which the code follows, so fixing the findings one by one would make the code worse.

## Problem
There are about 217 Info findings under `proxy/` (179 on the first five Codacy pages plus 38 on the last). For example:

- `Squiz.Arrays.ArrayDeclaration` ×93 ("Array key not aligned correctly", which forces column alignment)
- `PEAR.Commenting.FunctionComment` ×19, `PEAR.Functions.FunctionCallSignature` ×19
- `Squiz.WhiteSpace.FunctionSpacing` ×15 ("Expected 2 blank lines")
- `Squiz.Strings.ConcatenationSpacing` ×10 ("Concat operator must not be surrounded by spaces", the opposite of PSR-12)
- `Squiz.Commenting.ClosingDeclarationComment` ×6 (requires `//end foo()` comments)

Most of them are in `proxy/dev_configuration/rules/*.php`, `proxy/prod_configuration/rules/*.php` and `proxy/extension/{lib,tests}/`.

## Expected Behavior
- PHPCS findings reflect PSR-12. The Squiz/PEAR style conflicts disappear.
- Any genuine PSR-12 violations the new ruleset reports are fixed.
- PSR-12 compliance of the proxy code can be checked locally through `docker-compose`.

## Solution
- Add a PHPCS ruleset (`phpcs.xml`) that applies `PSR12` to `proxy/extension/lib`, `proxy/extension/tests`, `proxy/dev_configuration` and `proxy/prod_configuration`.
- Codacy reads a PHP_CodeSniffer ruleset only from the location its docs name (`phpcs.xml`/`ruleset.xml` at the repository root). Confirm that. If the root is required, put the file there with `proxy/...` paths.
- Codacy may also need its "use configuration file" option switched on for PHP_CodeSniffer in the Codacy UI. The PR must mention any manual Codacy UI step like this.
- Add a new `proxy_lint` service to `docker-compose.yml`. It uses the same `darthjee/tent-test` image as `proxy_tests`, which already bundles `vendor/bin/phpcs`. It mounts the root `phpcs.xml` and `proxy/`, and runs `vendor/bin/phpcs` with that ruleset. Leave `proxy_tests` unchanged, and do not add a CircleCI step.
- The root `phpcs.xml` belongs to the **proxy** agent, because it only concerns `proxy/` code. Extend the proxy agent's documented scope to cover it (and the `proxy_lint` service), and update the agent docs to mention the new lint command.
- Fix any real PSR-12 violations the new ruleset reports.
- If Codacy does not honour the ruleset, the fallback, which needs no repository change, is to turn off the Squiz/PEAR patterns in the Codacy UI. Mention it in the PR in that case.

## Benefits
Removes about 217 Info findings that push the code away from PSR-12, and makes Codacy check the style the project actually uses.

## Verification

- `docker-compose run --rm proxy_tests` passes.
- `docker-compose run --rm proxy_lint` reports no violations.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
