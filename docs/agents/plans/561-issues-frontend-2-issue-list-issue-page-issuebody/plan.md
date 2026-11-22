# Plan: Issues: frontend 2 (issue list, issue page, IssueBody)

Issue: [561-issues-frontend-2-issue-list-issue-page-issuebody.md](../../issues/561-issues-frontend-2-issue-list-issue-page-issuebody.md)

## Overview
This plan builds the issue list under the project header, the shared link-column badge, the issue page, and the issue create and edit forms. It also builds a shared rate-limit countdown and the lazy-loaded restricted-Markdown `IssueBody`. Everything is frontend-only and uses the `IssuesClient` that #560 shipped. The three issue routes move from `ProjectsPlaceholder` to the new screens.

See [frontend.md](frontend.md) for the full plan.
