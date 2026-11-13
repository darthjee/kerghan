# Plan: Repositories: API routes

Issue: [464-repositories-api-routes.md](../../issues/464-repositories-api-routes.md)

## Overview

This plan exposes #463's `RepositoriesService` over HTTP. It adds four `POST` routes on a thin `RepositoriesController`: listing, sync state, Refresh and Add. The Add flow lives in a new `RepositoryAddService`, rate limited per user in memory. The plan also adds three error codes, puts the error filter's `retryAfterSeconds` into the response body, and adds the Repositories ESLint boundary with its static spec. On the test side it adds the route access matrix, the canary sweep and the cache coverage. The docs it touches are `api.md`, `environment-variables.md` and the specs README. The backend agent owns everything.

See [backend.md](backend.md) for the full plan.
