# Plan: Refactor: Scoped Codacy ESLint exclusions for auth event classes and logging.module.ts

Issue: [225-refactor-scoped-codacy-eslint-exclusions-for-auth-event-classes-and-logging-module-ts.md](../../issues/225-refactor-scoped-codacy-eslint-exclusions-for-auth-event-classes-and-logging-module-ts.md)

## Overview
Configuration-only change: add a scoped ESLint `exclude_paths` block to the root `.codacy.yml` covering exactly seven files, so Codacy stops reporting 17 false-positive Warnings. No source code changes.

## Context
- Codacy's ESLint applies the base `no-unused-vars` rule, which misreads TypeScript constructor parameter properties (`constructor(readonly userId: number) {}`) in the six `backend/src/auth/events/*.event.ts` classes (16 findings). The repo's own `backend/eslint.config.mjs` turns the base rule off for TS files and uses `@typescript-eslint/no-unused-vars`, so local lint is clean.
- Codacy also flags `@typescript-eslint/no-extraneous-class` on `LoggingModule` (`backend/src/core/logging.module.ts:28`), an empty decorated NestJS module (1 finding).
- `.codacy.yml` already holds one scoped exclusion (PMD, issue #30) and states the rule "scoped, narrow exclusions only", with each entry commented with its reason.
- `.codacy.yml` is a root-level file, so no specialist agent owns it. This plan is architect-level.

## Implementation Steps

### Step 1 — Confirm the Codacy ESLint engine key
Check Codacy's configuration-file docs (https://docs.codacy.com/repositories-configure/codacy-configuration-file/) for the short name of the ESLint tool this project uses (e.g. `eslint`, `eslint-8` or `eslint-9`; the backend uses ESLint 9 flat config). Use that key under `engines:`. If the right key can't be pinned down, list the same `exclude_paths` under each candidate ESLint key rather than guessing one. Say which you did in the PR description.

### Step 2 — Add the scoped ESLint exclusions to `.codacy.yml`
Add an `engines.<eslint-key>.exclude_paths` block next to the existing `pmd` block, in the same style: a comment per group explaining why it is excluded, and one path per line (no globs):

- Group 1 (comment: Codacy's base `no-unused-vars` misreads TS constructor parameter properties as unused parameters; the repo's own ESLint uses `@typescript-eslint/no-unused-vars` and reports nothing; see issue #225):
  - `backend/src/auth/events/authorization-request-approved.event.ts`
  - `backend/src/auth/events/authorization-request-created.event.ts`
  - `backend/src/auth/events/authorization-request-denied.event.ts`
  - `backend/src/auth/events/authorization-request-logged.event.ts`
  - `backend/src/auth/events/password-recovery-requested.event.ts`
  - `backend/src/auth/events/user-registered.event.ts`
- Group 2 (comment: `@typescript-eslint/no-extraneous-class` flags the empty class body, but an empty class is how a decorated NestJS `@Module` is declared; see issue #225):
  - `backend/src/core/logging.module.ts`

Do **not** add `backend/src/auth/events/password-recovery-requested.listener.ts` (it has real logic and must stay analysed), `auth.module.ts` or `mail.module.ts` (not reported; out of scope).

## Files to Change
- `.codacy.yml` — add the ESLint `exclude_paths` block described above.

## Notes
- An exclusion hides *all* ESLint findings in the listed files, which is why each path is listed individually and commented.
- No code changes in this issue. If Codacy turns out not to honour the key, the fix is a separate follow-up issue; don't rewrite the event classes here.
- Other open Codacy-config issues also edit `.codacy.yml`; rebase on whichever merges first and keep every block.
- Verification happens after merge: Codacy's re-analysis of `main` should no longer report the 17 findings. No local test or lint command covers `.codacy.yml`.
