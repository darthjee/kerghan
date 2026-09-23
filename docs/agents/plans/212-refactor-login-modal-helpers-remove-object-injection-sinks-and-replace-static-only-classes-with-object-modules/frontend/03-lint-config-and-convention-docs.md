# Drop lint exemptions and update the helper convention
- In `frontend/eslint.config.mjs`, remove `assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx` and `assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` from the `reportUnusedDisableDirectives: 'off'` `files` list — they no longer carry Codacy-only suppressions.
- In `.claude/agents/frontend.md`, section "When to extract JSX into a component vs. a helper method":
  - Rename "Extract to a private `#renderX` static method in the helper when" to describe a private module-level `renderX` function in the helper module.
  - Update the quick decision guide's last line to match.
  - Add a short note that helpers are plain exported objects (`const XHelper = { render() {…} }; export default XHelper;`), not static-only classes: writable (no `Object.freeze`, so `spyOn` works), with private rendering pieces as non-exported module-level functions and table lookups through `Map`. Say that older helpers/clients are still being migrated (#214, #227–#230).
- Run `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage`.

## Files to Change
- `frontend/eslint.config.mjs` — remove the two login-modal helpers from the unused-directive exemption list.
- `.claude/agents/frontend.md` — document the object-module helper convention.
