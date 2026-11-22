# Plan: Issues: GitHub issue client in Integrations

Issue: [554-issues-github-issue-client-in-integrations.md](../../issues/554-issues-github-issue-client-in-integrations.md)

## Overview

Add the GitHub issue client to the Integrations module. `IntegrationsGithubService` gains `getIssue` and `probeIssues` and stays `GET`-only. A separate exported `IntegrationsGithubIssueWriter` adds `updateIssue`. The plan also covers per-operation GitHub App tokens, redirect classification, the extended fake and its builders, the two contract specs, the writer boundary spec and the doc updates.

The single owner is `backend`. The full plan is in [backend.md](backend.md).
