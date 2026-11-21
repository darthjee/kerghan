# Plan: Issues: projects API

Issue: [555-issues-projects-api.md](../../issues/555-issues-projects-api.md)

## Overview

Builds the seven project routes of the Issues module (`/projects/mine.json`, `create.json`, `from-repository.json` and `/projects/:projectId/{show,edit,repository,delete}.json`) on the foundation merged by #553. It covers the project creation paths, the cap, repository attach, change and detach, soft delete, `openIssueCount`, the project error codes, `error.meta` and the code-point length validator.

See [backend.md](backend.md) for the full plan.
