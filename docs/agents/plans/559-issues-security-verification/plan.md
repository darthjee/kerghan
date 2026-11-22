# Plan: Issues: security verification

Issue: [559-issues-security-verification.md](../../issues/559-issues-security-verification.md)

## Overview

This plan closes the backend security verification of the Issues feature. It adds:

- one route access matrix with a global completeness check and the admin column;
- credential and content canary sweeps against the real Integrations services;
- the job-params allowlist across those sweeps;
- unique-index logging specs;
- an intruder seeded in every DB harness;
- tests for the uncovered edge cases, with every edge-case row cited.

The work is test-only, apart from production fixes for any gap the sweeps uncover.

See [backend.md](backend.md) for the full plan.
