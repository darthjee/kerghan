# Issue: Refactor: Scoped Codacy ESLint exclusions for auth event classes and logging.module.ts

## Description
Codacy's ESLint run applies the base `no-unused-vars` rule, which misreads TypeScript constructor parameter properties, and flags an empty decorated NestJS `@Module` class as extraneous. These are false positives that cannot be fixed idiomatically in the code.

## Problem
- 16 `no-unused-vars` (Warning), e.g. `'userId' is defined but never used`, in `backend/src/auth/events/password-recovery-requested.event.ts` (4), `user-registered.event.ts` (3), `authorization-request-created.event.ts` (3), `authorization-request-logged.event.ts` (2), `authorization-request-denied.event.ts` (2), `authorization-request-approved.event.ts` (2). Each is `constructor(readonly userId: number, ...) {}`, where the parameter property *is* the declaration; the repo's own ESLint (`backend/eslint.config.mjs`: base `no-unused-vars` off for TS, `@typescript-eslint/no-unused-vars` on) does not report it.
- 1 `@typescript-eslint/no-extraneous-class` (Warning) at `backend/src/core/logging.module.ts:28` — an empty class is how a decorated NestJS module is declared.

## Expected Behavior
The 17 findings no longer appear in Codacy, and no unrelated ESLint finding is hidden without being documented.

## Solution
- Add scoped entries to `.codacy.yml` under `engines.<eslint-engine>.exclude_paths` (confirm the exact engine key in Codacy's configuration-file docs) for the six event files and `logging.module.ts`, each with a comment stating the reason, following the existing PMD entry from issue #30 and the file's rule "scoped, narrow exclusions only".
- An exclusion hides *all* ESLint findings in those files, so list files individually rather than a directory glob (`password-recovery-requested.listener.ts` lives in the same folder and must stay analysed).
- Inline `eslint-disable` comments are not an option: the base `no-unused-vars` rule is off in the repo's ESLint, so the directives would be reported as unused.
- Scope is limited to the reported findings: `AuthModule` and `MailModule` are also empty `@Module` classes but were not reported, so they are not excluded here.
- No code changes in this issue. If Codacy turns out not to honour the key, that is handled in a separate follow-up rather than by rewriting the event classes here.
- This issue edits `.codacy.yml`, as do the other Codacy-config issues; rebase on whichever merges first.

## Benefits
Removes 17 Warning findings without weakening the analysis elsewhere, and records why each exclusion exists.

## Verification
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
