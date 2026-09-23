# Backend Plan: Refactor: Fix object-injection lookups and dead conditional in mail.service.ts

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Replace the `Record` lookup with a `Map` in `MailService`

In `backend/src/mail/mail.service.ts`:

- Keep the constructor's injected parameter typed as `Record<string, EmailMethod>`
  (`@Inject(MAIL_METHODS) methods: Record<string, EmailMethod>`, line 76) — `mail.module.ts` and the
  provider token type are out of scope for this issue.
- Change the private field from `private readonly methods: Record<string, EmailMethod>;` (line 63)
  to `private readonly methods: Map<string, EmailMethod>;`, and build it once in the constructor
  body (replacing the current `this.methods = methods;` assignment at line 81) via
  `this.methods = new Map(Object.entries(methods));`.
- In `#deliver` (line 199), replace `this.methods[method]` with `this.methods.get(method)`. Since
  `Map#get` returns `EmailMethod | undefined`, destructuring `.deliver(...)` directly off it will no
  longer type-check without narrowing — reuse `#assertKnownMethod`'s guard (it already runs earlier,
  at line 153, before `#deliver` is reached) or add a local narrowing step in `#deliver` itself so
  the compiler sees a non-undefined `EmailMethod` at the call site. Pick whichever reads cleanest
  (e.g. having `#assertKnownMethod` return the resolved `EmailMethod`, or an inline
  `const resolved = this.methods.get(method); if (!resolved) { throw ... }` in `#deliver`) — the
  important constraint is that both the object-injection and the dead-conditional findings disappear
  without changing the public throw message or behavior.
- In `#assertKnownMethod` (line 210-214), replace `this.methods[method]` with
  `this.methods.get(method)`; the `if (!this.methods.get(method))` check now tests a genuinely
  possibly-`undefined` value, so `no-unnecessary-condition` no longer flags it.
- `deliver` must keep throwing `mail: unknown method: <name>` for an unrecognized method name, and
  keep delivering through the chosen method otherwise — no change to `SendEmailResult`, logging, or
  any other behavior in the file.

## Files to Change

- `backend/src/mail/mail.service.ts` — private `methods` field becomes a `Map<string, EmailMethod>`
  built from the injected `Record` in the constructor; both lookup sites (`#deliver`,
  `#assertKnownMethod`) use `.get()` instead of index access.

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes

- `backend/src/mail/tests/mail.service.spec.ts` already covers the unknown-method case twice
  (`:158` "still throws for an unknown method..." and `:168` "when the method is unknown... rejects
  before any delivery attempt") — no new spec case should be needed unless the refactor changes
  `#assertKnownMethod`'s signature/return shape, in which case update those existing specs rather
  than adding new ones.
- Do not touch `mail.module.ts` or the `MAIL_METHODS` provider token type — reserved for the
  separate backend TS-lint-cleanup issue.
- Coverage must not drop as a result of this change (per the issue's Verification section).
