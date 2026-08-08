# Architect Plan: Add login and register, frontend and backend

Main plan: [plan.md](plan.md)

Scope: `backend/` (no dedicated `backend` agent exists yet — see
`.claude/agents/architect.md`, "There is no `backend` agent definition
yet... treat `backend/` changes as your own scope").

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" for the full
`POST /accounts/register.json` request/response shape and the
`/login.json` → `/accounts/login.json` rename. This file only needs to
*produce* that contract; the frontend consumes it via `AccountsClient`.

## Implementation Steps

### Step 1 — `Registrar` domain class

New file `backend/lib/accounts/Registrar.js`, mirroring `Authenticator.js`'s
shape (a small class taking the injected `User` model in its constructor,
one public async method):

```js
class Registrar {
  #userModel;

  constructor(userModel) { this.#userModel = userModel; }

  async register({ username, email, password }) {
    const passwordDigest = await bcrypt.hash(password, 10);
    try {
      return await this.#userModel.create({ username, email, passwordDigest });
    } catch (e) {
      throw this.#toBadRequestError(e);
    }
  }

  #toBadRequestError(e) {
    // SequelizeUniqueConstraintError → "<field> is not available"
    // SequelizeValidationError (e.g. isEmail) → relay e.errors[0].message
    // anything else → rethrow unchanged (RouteRegister maps it to 500)
  }
}
```

- Uses `bcrypt.hash(password, 10)` (async form), same cost factor as
  `backend/seeders/20260808060903-demo-user.js`.
- Inspects `e.errors[0].path` (Sequelize's `ValidationErrorItem[]`, present
  on both `SequelizeUniqueConstraintError` and `SequelizeValidationError`)
  to build the field-specific message. For the unique-constraint case, map
  `path` (`'username'` or `'email'`) to `` `${path} is not available` ``.
  For a plain validation error (malformed email via the model's `isEmail`
  check), relay Sequelize's own message. Anything not recognized as one of
  these two Sequelize error classes should be rethrown as-is, so
  `RouteRegister` falls through to its generic 500 handling rather than
  masking an unexpected error as a 400.
- Does **not** handle the password/confirmation match check — that's
  `RegisterHandler`'s job (see Step 2), same division of concerns as
  `LoginHandler` doing its own presence check before calling
  `Authenticator`.

### Step 2 — `RegisterHandler`

New file `backend/lib/server/handlers/RegisterHandler.js`, following
`LoginHandler.js`'s exact shape (constructor takes `request`, `response`,
and the injected `Registrar`; `#regenerateSession()` private helper
duplicated the same way `LoginHandler` has its own copy — there's no shared
base class for this today, so don't invent one for just two handlers):

```js
async handle() {
  const { username, email, password, password_confirmation: passwordConfirmation } =
    this.#request.body ?? {};

  if (!username || !email || !password || !passwordConfirmation) {
    throw new BadRequestError('username, email, password and password_confirmation are required');
  }
  if (password !== passwordConfirmation) {
    throw new BadRequestError('password and password_confirmation do not match');
  }

  const user = await this.#registrar.register({ username, email, password });

  await this.#regenerateSession();
  this.#request.session.userId = user.id;
  this.#response.status(200).json(new UserSerializer(user).asJson());
}
```

### Step 3 — Wire up `Router.js`

In `backend/lib/server/Router.js`:
- Import `RegisterHandler` and `Registrar`.
- Instantiate `const registrar = new Registrar(this.#models.User);` next to
  the existing `authenticator` instantiation.
- Rename the `POST_ROUTES` key `'/login.json'` → `'/accounts/login.json'`
  (same `HandlerConfig(LoginHandler, authenticator)` value, unchanged).
- Add `'/accounts/register.json': new HandlerConfig(RegisterHandler, registrar)`.

### Step 4 — Specs

- `backend/spec/accounts/Registrar_spec.js`, mirroring
  `Authenticator_spec.js`'s mocking style (`jasmine.createSpyObj('User',
  ['create'])`): covers successful creation (resolves with the created
  user, calls `create` with a hashed `passwordDigest` — assert the digest
  differs from the plaintext and `bcrypt.compare` against it succeeds,
  rather than asserting an exact hash), a duplicate-username rejection
  (mock `create` to reject with a `SequelizeUniqueConstraintError`-shaped
  object whose `errors[0].path` is `'username'`, assert `BadRequestError`
  with `'username is not available'`), same for `'email'`, and a malformed
  email (mock a `SequelizeValidationError`-shaped rejection, assert the
  relayed message).
- `backend/spec/server/handlers/RegisterHandler_spec.js`, mirroring
  `LoginHandler_spec.js`'s structure exactly (same `request`/`response`
  spy shape, a `registrar` spy object instead of `authenticator`): covers
  success (200 + serialized user, session regenerated, `userId` set),
  missing-field rejection (`BadRequestError`, `registrar.register` never
  called), mismatched password confirmation (`BadRequestError`,
  `registrar.register` never called), and propagation of a
  `BadRequestError` thrown by `registrar.register` (duplicate
  username/email case, already covered at the `Registrar` level — this
  spec just confirms the handler doesn't swallow it).

No spec references the literal route path (`LoginHandler_spec.js`
instantiates `LoginHandler` directly, not through `Router`), so the
`/login.json` → `/accounts/login.json` rename needs no spec changes beyond
what Step 4 already adds for the new handler.

## Files to Change

- `backend/lib/accounts/Registrar.js` — new
- `backend/lib/server/handlers/RegisterHandler.js` — new
- `backend/lib/server/Router.js` — add `Registrar`/`RegisterHandler`
  imports and instantiation; rename `/login.json` → `/accounts/login.json`;
  add `/accounts/register.json`
- `backend/spec/accounts/Registrar_spec.js` — new
- `backend/spec/server/handlers/RegisterHandler_spec.js` — new

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`) and `npm run
  lint` (CI job: `backend_checks`) — run via
  `docker-compose run --rm kerghan_app <command>` locally, per
  `architect.md`'s "never run language tooling on the host" rule.

## Notes

- No shared base class exists yet for the `#regenerateSession()` helper
  duplicated between `LoginHandler` and `RegisterHandler` — leave the
  duplication as-is (two small handlers don't justify a new abstraction);
  revisit if a third handler needs session regeneration.
- `Registrar`'s exact Sequelize error shape (`e.errors[0].path`,
  `e instanceof SequelizeUniqueConstraintError` /
  `SequelizeValidationError`, both exported from the `sequelize` package)
  should be double-checked against the installed `sequelize` version
  (`^6.37.0`) while implementing — the general shape has been stable across
  Sequelize 6.x, but verify with a quick spec run rather than assuming.
