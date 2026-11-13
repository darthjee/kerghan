# Plan: Repositories: Integrations — export IntegrationsGithubService

Issue: [461-repositories-integrations-export-integrationsgithubservice.md](../../issues/461-repositories-integrations-export-integrationsgithubservice.md)

## Overview

Backend-only work in `backend/src/integrations/` and `backend/src/core/`. It adds and exports `IntegrationsGithubService`, the single GET-only GitHub client that Repositories (#463) uses, with all of the following inside Integrations:
- the installation-token cache;
- the `secret_iv` compare-and-set invalidation;
- the error-mapping table;
- the unauthenticated budget tracker;
- the Add re-check walk;
- the `integration.deleted` emitter.

It also moves the 502/503 helpers to `core/` and adds a shared `Clock`. It ships the typed fake, the shared builders and the fake-fidelity contract spec, so #463 can build on them.

See [backend.md](backend.md) for the full plan.
