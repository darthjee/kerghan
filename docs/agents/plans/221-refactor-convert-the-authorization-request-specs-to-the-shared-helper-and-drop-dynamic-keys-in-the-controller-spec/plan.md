# Plan: Refactor: Convert the authorization-request specs to the shared helper and drop dynamic keys in the controller spec

Issue: [221-refactor-convert-the-authorization-request-specs-to-the-shared-helper-and-drop-dynamic-keys-in-the-controller-spec.md](../../issues/221-refactor-convert-the-authorization-request-specs-to-the-shared-helper-and-drop-dynamic-keys-in-the-controller-spec.md)

## Overview
Spec-only refactor in the frontend: convert the two authorization-request markup specs to the shared `renderedOutput` helper and replace the string-keyed `method` / `clientMethod` params in the controller spec's `itBehavesLikeRowAction` with `stub` / `act` functions, clearing 27 High Codacy findings.

See [frontend.md](frontend.md) for the full plan.
