# Issue: Refactor: extract shared boolean-metadata-reading helper from AdminGuard/JwtGuard/SkipCacheInterceptor

## Description
`AdminGuard`, `JwtGuard`, and `SkipCacheInterceptor` each implement the same boolean-metadata-reading pattern for different metadata keys.

## Problem
`src/core/admin.guard.ts` (`#isAdminOnly`), `src/core/jwt.guard.ts` (`#isPublic`), and `src/core/skip-cache.interceptor.ts` (`#isSkipCache`) all do:

```ts
Boolean(this.reflector.getAllAndOverride<boolean>(SOME_KEY, [context.getHandler(), context.getClass()]))
```

differing only in which metadata key is read. All three are documented as "Core," always-resident, global guards/interceptors meant to be a stable pattern — more of them reading route-level boolean metadata are likely to be added over time, each repeating this same snippet.

## Expected Behavior
`AdminGuard`, `JwtGuard`, and `SkipCacheInterceptor` all read their boolean route metadata through one shared helper; their behavior (which routes are treated as admin-only/public/skip-cache) is unchanged.

## Solution
Extract a shared helper, e.g. `readBooleanMetadata(reflector: Reflector, key: string, context: ExecutionContext): boolean`, in `src/core/`, used by `AdminGuard`, `JwtGuard`, and `SkipCacheInterceptor` in place of their private duplicate methods.

## Benefits
Establishes one reusable, tested way to read boolean route metadata for any future Core guard/interceptor, instead of each one re-deriving the same `getAllAndOverride` incantation.
