# Verify with the real no-mixed-html rule
Run the real `eslint-plugin-xss` rule once, inside the `kerghan_fe` container, **without** changing `package.json`, `yarn.lock` or `eslint.config.mjs`.

Suggested one-off:
1. Install the plugin into a throwaway directory inside the container, for example `npm install --prefix /tmp/xss eslint-plugin-xss`.
2. Run ESLint with a temporary flat config written to `/tmp` that loads only `xss/no-mixed-html` (set to `error`), with JSX parsing enabled, against:
   - `specs/support/renderedOutput.js`
   - `specs/support/accountEditFormHelperExamples.js`
   - `specs/support/accountEditPageExamples.js`
   - the two caller specs

   Pass `--no-config-lookup -c /tmp/xss/eslint.config.mjs`.
3. For a baseline, run the same command against `origin/main`'s versions of the files (for example via `git stash` or a `git show` copy). It should reproduce roughly the 20 reported findings, which shows the local run matches Codacy's behaviour.

Put the exact command and both outputs (baseline and after) in the PR description. Do not commit anything from this step.

**Gate:** if the after-run reports any finding, stop and revise the approach in the PR description. Do not add per-file workarounds or inline disables. Also confirm `git status` shows no dependency or config changes.

## Files to Change
- None: verification only. The results go in the PR description.
