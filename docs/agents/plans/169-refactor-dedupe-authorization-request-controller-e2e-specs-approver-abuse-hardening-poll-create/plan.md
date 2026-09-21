# Plan: Refactor: dedupe authorization-request controller e2e specs (approver, abuse-hardening, poll, create)

Issue: [169-refactor-dedupe-authorization-request-controller-e2e-specs-approver-abuse-hardening-poll-create.md](../../issues/169-refactor-dedupe-authorization-request-controller-e2e-specs-approver-abuse-hardening-poll-create.md)

## Overview
Extract shared request/assert/setup helpers into `authorization-request.controller.e2e-test-support.ts` and use them from the four authorization-request controller e2e specs, removing the jscpd-flagged clones without changing any test or assertion.

See [backend.md](backend.md) for the full plan.
