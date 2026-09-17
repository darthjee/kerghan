# Issue: Refactor: unused variable in mail.method.ts and unnecessary async in admin.service.ts

## Description

Codacy flagged two small code-quality items in the backend: an "unused variable" in
`mail.method.ts` and an unnecessary `async` keyword in `admin.service.ts`.

## Problem

1. `backend/src/mail/mail.method.ts:38` — Codacy reports `message` as an unused
   variable on the `EmailMethod.deliver(message: EmailMethodMessage)` line. That
   line is an interface method *signature* (no body), so `message` is a
   documentation-only parameter name, not a real binding. The project's own
   ESLint run (`docker-compose run --rm kerghan_tests yarn lint`) passes clean on
   this file, so this looks like a Codacy-side false positive rather than a real
   lint violation in this repo's config — still worth silencing at the source
   by renaming the parameter (see Solution).
2. `backend/src/auth/admin.service.ts:60` — `AdminService.searchUsers` is
   declared `async` but its body only returns `this.userRepository.find(...)`
   calls directly, never `await`-ing them. This is a real (if harmless) async
   hygiene issue: the `async` keyword is unnecessary since the method already
   returns a `Promise<User[]>` on every path. It doesn't fail today's lint only
   because `@typescript-eslint/require-await` isn't enabled in
   `backend/eslint.config.mjs`.

## Solution

1. `mail.method.ts:38` — although not a real unused-variable violation (it's an
   interface signature, and this repo's own lint passes clean), rename the
   parameter to `_message` on both the `EmailMethod.deliver` interface
   signature and the matching `@param` JSDoc tags, matching this repo's
   existing `argsIgnorePattern: '^_'` ESLint convention and silencing
   Codacy's scanner. Purely cosmetic — `NativeEmailMethod.deliver`'s actual
   implementation (which does use `message`) is untouched.
2. `admin.service.ts:60` — remove the unnecessary `async` keyword from
   `searchUsers`, returning the `Promise<User[]>` from `this.userRepository.find(...)`
   directly. The method's declared return type (`Promise<User[]>`) and all
   call sites (`await this.adminService.searchUsers(...)` in
   `admin.controller.ts`) are unaffected.

## Benefits

- Clears the one legitimate async-hygiene nit Codacy found, keeping the
  codebase consistent with the project's "no unnecessary `async`" convention
  seen elsewhere.
- Avoids a no-op "fix" for the interface signature that would only serve to
  quiet an external scanner without any real bug or lint violation behind it.
