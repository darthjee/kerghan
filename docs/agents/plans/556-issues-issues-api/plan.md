# Plan: Issues: issues API

Issue: [556-issues-issues-api.md](../../issues/556-issues-issues-api.md)

## Overview

This plan builds the backend Issues API for a project's Kerghan issues: list, create, show, edit and delete, under `/projects/:projectId/issues…`. It includes:

- the per-project issues cap;
- the per-user edit rate limit, weighted so #563's bulk call can reuse it;
- the marker upsert in the edit transaction for linked issues.

It also adds two seams that later issues fill in. The issue object's `link` comes from one presenter, which returns `null` until #557 fills it in. The after-commit sync trigger is a port with a no-op default, which #558 binds to the real T1 enqueue.

See [backend.md](backend.md) for the full plan.
