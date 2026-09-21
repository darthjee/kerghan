# Migrate the pages and update docs
Replace the duplicated state/handler wiring in both pages with the hook, keeping only what genuinely differs:

- `MyAccount.jsx`: keep `INITIAL_FIELDS` (with `currentPassword`), call `useAccountEditForm({ initialFields: INITIAL_FIELDS, createController: (...setters) => new MyAccountController(...setters), submit: (controller, fields) => controller.handleSubmit(fields) })`, then `return MyAccountHelper.render(state, handlers)`. Drop the now-unused `useMemo`/`useState` imports.
- `AdminUserEdit.jsx`: keep `INITIAL_FIELDS`, `currentHash()` and the `userId` `useMemo` route-param lookup; call the hook with `AdminUserEditController` and `submit: (controller, fields) => controller.handleSubmit(userId, fields)`, then `return AdminUserEditHelper.render(state, handlers)`. Keep `useMemo` (still used for `userId`); drop `useState`.
- Update the directory-layout block in `docs/agents/architecture/frontend.md` so the `common/forms/` entry also lists `hooks/useAccountEditForm.js` (shared state/handler wiring for `MyAccount` / `AdminUserEdit`).
- Do not edit `MyAccountSpec.js` / `AdminUserEditSpec.js`; they must pass as-is. Run `yarn lint` and `yarn coverage` via `docker-compose run --rm kerghan_fe` and fix any lint/complexity/JSDoc findings.

## Files to Change
- `frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx` — use the hook; remove duplicated state/handlers.
- `frontend/assets/js/components/resources/admin/pages/AdminUserEdit.jsx` — use the hook; keep `currentHash()` + `userId` lookup.
- `docs/agents/architecture/frontend.md` — mention the new `common/forms/hooks/` entry in the layout.
