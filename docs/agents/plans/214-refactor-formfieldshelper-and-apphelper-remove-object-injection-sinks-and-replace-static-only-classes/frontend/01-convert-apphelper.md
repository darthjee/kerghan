# Convert AppHelper to an object module with a Map page lookup

Replace the `PAGES` plain object with a `Map` of `[key, element]` entries in the same order (`register`, `login`, `reset-password`, `admin-users`, `admin-user-edit`, `authorization-requests`, `my-account`, `home`). Resolve the page with `PAGES.get(page) ?? PAGES.get('home')`, so an unknown key, including the removed `recover` key, still falls back to `home`.

Replace `export default class AppHelper { static render(page) … }` with a plain object literal `const AppHelper = { render(page) { … } }; export default AppHelper;`, following the object-module shape in `LoginModalHelper.jsx`. Update the JSDoc to describe the object-module shape, and remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` directive together with its explanatory comment lines.

## Files to Change
- `frontend/assets/js/components/helpers/AppHelper.jsx`: `Map`-based `PAGES`, object-literal export, no disable directive.
