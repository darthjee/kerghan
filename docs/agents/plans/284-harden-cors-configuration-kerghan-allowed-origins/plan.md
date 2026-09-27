# Plan: Harden CORS configuration (KERGHAN_ALLOWED_ORIGINS)

Issue: [284-harden-cors-configuration-kerghan-allowed-origins.md](../../issues/284-harden-cors-configuration-kerghan-allowed-origins.md)

## Overview
Add a boot-time, fail-fast CORS allowlist resolver to the backend. It reads `KERGHAN_ALLOWED_ORIGINS`, falls back to the origin of `FRONTEND_BASE_URL`, and applies a `NODE_ENV=production` wildcard guard. `main.ts` enables credentialed CORS only when the resolver returns options. The work is backend-only, plus updates to the env-var docs.

See [backend.md](backend.md) for the full plan.
