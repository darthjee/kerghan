# Plan: Refactor: Remove dynamic-key access in shared spec support and RegisterControllerSpec

Issue: [224-refactor-remove-dynamic-key-access-in-shared-spec-support-and-registercontrollerspec.md](../../issues/224-refactor-remove-dynamic-key-access-in-shared-spec-support-and-registercontrollerspec.md)

## Overview
Frontend spec-only refactor that removes the 8 Codacy `security/detect-object-injection` findings in the shared spec support files and `RegisterControllerSpec`, without changing any test case or its pass/fail behaviour.

See [frontend.md](frontend.md) for the full plan.
