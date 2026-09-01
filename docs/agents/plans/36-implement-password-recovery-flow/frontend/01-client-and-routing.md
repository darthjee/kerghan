# Client methods and routing

Add the two `AccountsClient` methods and wire up both new hash routes, ahead of building the
pages that use them.

`AccountsClient` gains two methods, styled like `login`/`register` but — unlike them — never
touching `AuthSession` (neither flow issues a refresh token):

```ts
static async recover(email) {
  return ApiClient.postJson('/auth/recover.json', { email });
}

static async resetPassword({ token, password, passwordConfirmation }) {
  return ApiClient.postJson('/auth/reset-password.json', {
    token,
    password,
    password_confirmation: passwordConfirmation,
  });
}
```

In `HashRouteResolver.js`, add two entries to `ROUTES`, before the catch-all `/`:

```js
const ROUTES = [
  ['/register', 'register'],
  ['/login', 'login'],
  ['/recover', 'recover'],
  ['/recover-password', 'reset-password'],
  ['/', 'home'],
];
```

(`getPage()` already strips the query string via `.split('?')[0]` before resolving, so
`#/recover-password?token=...` resolves to `'reset-password'` with no further router change.)

In `AppHelper.jsx`, import the two new pages and add their keys to `PAGES`:

```js
const PAGES = {
  register: <Register />,
  login: <Login />,
  recover: <Recover />,
  'reset-password': <ResetPassword />,
  home: <Home />,
};
```

No change needed in `HeaderHelper.jsx` — `<Nav.Link href="#/recover">Recover</Nav.Link>` (added
in #35) already targets the route just registered.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — add `recover`, `resetPassword`.
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — add the two `ROUTES` entries.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — import `Recover`/`ResetPassword`
  (added in steps 02/03) and add their `PAGES` entries.
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — specs for `recover`/`resetPassword`,
  mirroring the existing `.register`/`.login` describe blocks (request shape, resolved value,
  and — unlike those two — asserting `AuthSession` is left untouched).
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — specs for both new routes
  resolving correctly, including with a `?token=...` query string on `/recover-password`.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — specs asserting the two new
  page keys render their components.
