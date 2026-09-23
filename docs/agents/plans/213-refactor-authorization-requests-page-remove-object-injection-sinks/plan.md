# Plan: Refactor: Authorization-requests page: remove object-injection sinks

Issue: [213-refactor-authorization-requests-page-remove-object-injection-sinks.md](../../issues/213-refactor-authorization-requests-page-remove-object-injection-sinks.md)

## Overview
Store the authorization-requests page's per-row UI state in a `Map` keyed by request UUID instead of a plain object. Merge the duplicated row-patch logic into one public `AuthorizationRequestsController#patchRow`. All work is in the frontend.

See [frontend.md](frontend.md) for the full plan.
