# Add a mail-template spec for `password-recovery`

Replace the coverage the deleted `password-recovery-email.content.spec.ts` provided with a
spec that exercises the **real on-disk** `password-recovery` template through
`buildTemplateRegistry` + `renderTemplate`. Implementer's choice between a new file and
extending `render-template.spec.ts`; a new file is cleaner since `render-template.spec.ts`
currently uses a synthetic in-memory registry only.

Suggested: `backend/src/mail/tests/password-recovery.template.spec.ts`, following
`template-registry.spec.ts`'s pattern:

```ts
import { join } from 'node:path';
import { buildTemplateRegistry } from '../template-registry.js';
import { renderTemplate } from '../render-template.js';

const registry = buildTemplateRegistry(join(__dirname, '..', 'templates'));
const resetUrl = 'https://app.example/#/recover-password?token=abc123';
```

Assertions:

- `registry` has a `password-recovery` key.
- `renderTemplate(registry, 'password-recovery', { resetUrl }).subject` is
  `'Reset your Kerghan password'`.
- `.text.split('\n')` contains `resetUrl` (the URL on a line by itself).
- `.text` contains `'can only be used once'`.
- `.text` contains `"If you didn't ask to reset your password"`.
- The rendered result has no `html` key (`expect('html' in result).toBe(false)`).
- `renderTemplate(registry, 'password-recovery', {})` throws
  `"mail: template 'password-recovery' is missing variable 'resetUrl'"`.

Do **not** assert byte-for-byte equality with the old `buildPasswordRecoveryEmail` output or
the absence of a trailing newline — the issue relaxed that.

## Files to Change

- `backend/src/mail/tests/password-recovery.template.spec.ts` — new (or an added `describe`
  block in `backend/src/mail/tests/render-template.spec.ts`).
