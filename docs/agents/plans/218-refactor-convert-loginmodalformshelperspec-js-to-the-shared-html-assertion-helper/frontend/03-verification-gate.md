# Run the real no-mixed-html verification gate
Before opening the PR, run the real rule once, using the throwaway setup documented in PR #257. Nothing gets committed.

1. Inside `docker-compose run --rm kerghan_fe sh -c '...'`:
   - `npm install --prefix /tmp/xss eslint-plugin-xss@0.1.12 eslint@8.57.1`
   - Write `/tmp/xss/eslint.config.mjs`:
     ```js
     import xss from '/tmp/xss/node_modules/eslint-plugin-xss/lib/index.js';
     export default [{ files: ['**/*.{js,jsx,mjs}'], plugins: { xss }, languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } }, rules: { 'xss/no-mixed-html': 'error' } }];
     ```
   - Run `env ESLINT_USE_FLAT_CONFIG=true /tmp/xss/node_modules/.bin/eslint --no-config-lookup -c /tmp/xss/eslint.config.mjs <files>`
2. Run it on the **baseline**, which is the `origin/main` copy of `LoginModalFormsHelperSpec.js`, e.g. extracted with `git show origin/main:<path>` into a temp dir. Then run it on the converted `LoginModalFormsHelperSpec.js`, `frontend/specs/support/renderedOutput.js` and `frontend/specs/support/renderedOutputSpec.js`.
3. The after-run must report **zero** findings. If anything still fires, fix it in the helper or in the naming. Never add per-file disable comments, because Codacy ignores them.
4. Put both outputs (baseline and after) in the PR description.
5. Run `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage`. Both must pass, and coverage must not drop.

## Files to Change
- None. This step only verifies the work, and its output goes in the PR description.
