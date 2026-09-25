# Add the root PSR-12 ruleset

Create `phpcs.xml` at the repository root so both Codacy and the local `proxy_lint` service check the proxy PHP against PSR-12 instead of Codacy's default Squiz/PEAR standards. Give it a `<description>` explaining why it exists, with a short XML comment pointing to issue #240. Contents:

- `<rule ref="PSR12"/>`
- `<arg name="extensions" value="php"/>`
- `<file>proxy/extension/lib</file>`, `<file>proxy/extension/tests</file>`, `<file>proxy/dev_configuration</file>`, `<file>proxy/prod_configuration</file>`

Don't add extra sniffs or exclusions. The point is plain PSR-12.

This root file is owned by the proxy agent (see step 03), because it only concerns `proxy/` code.

## Files to Change

- `phpcs.xml` (new): PSR-12 ruleset scoped to the four proxy paths.
