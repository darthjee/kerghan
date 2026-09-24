# Address the deliver interface parameter warning
In the `EmailMethod` interface, try declaring `deliver` as a function-typed property instead of a method signature, e.g. `deliver: (message: EmailMethodMessage) => Promise<EmailMethodResult>;` (renaming `_message` to `message` in both the signature and its JSDoc `@param`). Confirm `NativeEmailMethod implements EmailMethod` still type-checks and `yarn lint` passes.

If the rule still flags interface parameter names (known false positive), revert to the original method signature and note it in the PR description instead of adding a lint exclusion for one line.

## Files to Change
- `backend/src/mail/mail.method.ts` — `EmailMethod#deliver` declaration and its JSDoc.
