# Plan: Security: qs dependency vulnerable to Denial of Service (backend/yarn.lock)

Issue: [96-security--qs-dependency-vulnerable-to-denial-of-service--backend-yarn-lock.md](../../issues/96-security--qs-dependency-vulnerable-to-denial-of-service--backend-yarn-lock.md)

## Overview

Bump the `qs` package (a direct backend dependency pinned at `6.15.3`, flagged for two DoS CVEs) to the patched `6.16.0` release, and confirm the test suite still passes.

See [backend.md](backend.md) for the full plan.
