# Share console-spies helper
`core/tests/logger.service.spec.ts` and `core/tests/request-logging.e2e-spec.ts` both declare the same block:

```ts
const consoleSpies = {
  debug: jest.spyOn(console, 'debug').mockImplementation(() => undefined),
  info: jest.spyOn(console, 'info').mockImplementation(() => undefined),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => undefined),
  error: jest.spyOn(console, 'error').mockImplementation(() => undefined),
};
```

plus the same `Object.values(consoleSpies).forEach((spy) => spy.mockClear())` in `afterEach` and `mockRestore()` in `afterAll`.

Create `backend/src/core/tests/console-spies.test-support.ts` (the `*.test-support.ts` suffix is already used under `auth/tests` and is excluded from Jest's `testRegex`) exporting `createConsoleSpies()` (returns the object above), `clearConsoleSpies(spies)` and `restoreConsoleSpies(spies)`. Add JSDoc to each, matching the style in `logger.service.spec.ts`. Replace the inline blocks and the `forEach` lines in both specs. Keep `createConsoleSpies()` called at `describe` scope (not in `beforeAll`) so spy timing is unchanged.

## Files to Change
- `backend/src/core/tests/console-spies.test-support.ts` — new shared helper.
- `backend/src/core/tests/logger.service.spec.ts` — use the helper.
- `backend/src/core/tests/request-logging.e2e-spec.ts` — use the helper.
