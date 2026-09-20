# Plan: Refactor: dedupe repoMock test helper across password-reset.service.spec.ts and token.service.spec.ts

Issue: [144-refactor-dedupe-repomock-test-helper-across-password-reset-service-spec-ts-and-token-service-spec-ts.md](../../issues/144-refactor-dedupe-repomock-test-helper-across-password-reset-service-spec-ts-and-token-service-spec-ts.md)

## Overview
Extract the duplicated generic `RepoMock<T>`/`repoMock<T>()` fake-repository helper into a single shared `src/auth/tests/repo-mock.test-support.ts`, and adopt it in `password-reset.service.spec.ts`, `token.service.spec.ts` and `auth.service.spec.ts`.

See [backend.md](backend.md) for the full plan.
