# Add the CurrentUser param decorator

Create `backend/src/core/current-user.decorator.ts`, next to `jwt.guard.ts` (the guard that populates `request.user`). Export the factory function separately from the decorator itself, so the unit spec in step 03 can call it directly without booting a full Nest pipeline — the same testable-factory pattern Nest's own docs recommend for `createParamDecorator`:

```ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from './access-token-payload.js';

export const getCurrentUser = (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
  const request = context.switchToHttp().getRequest<Request>();

  if (!request.user) {
    throw new UnauthorizedException('Missing authenticated user');
  }

  return request.user;
};

export const CurrentUser = createParamDecorator(getCurrentUser);
```

Follow the existing JSDoc style used by `public.decorator.ts`/`admin-only.decorator.ts` (a short block comment above the export explaining what it does and why the guard makes the missing-user case effectively unreachable on protected routes, while still defending against it explicitly).

## Files to Change
- `backend/src/core/current-user.decorator.ts` — new file, the `@CurrentUser()` param decorator plus its exported factory function.
