# Redirect classification

Classify a `301` by its `Location` (E65, `security.md#redirects-never-carry-a-credential-off-github`). This is a pure function. The client in step 05 acts on its answer.

Create `backend/src/integrations/github-issue-redirect.ts` with `classifyIssueRedirect(location: string | null, repo: GithubIssueRepo, number: number)`, which returns one of:

- **`{ kind: 'renamed', url }`**, only when the `Location`, parsed with `new URL`:
  - has the protocol `https:` and the hostname `api.github.com`;
  - has no explicit port, username, password, query or fragment;
  - has a pathname exactly of the form `/repositories/{repo.githubId}/issues/{number}`, with both ids matching as decimal integers.

  `url` is rebuilt from `GITHUB_API_URL` and those two ids, never copied from the header.
- **`{ kind: 'moved' }`** for any other `https://api.github.com` `Location` with no port, credentials, query or fragment.
  - This rests on an assumption: GitHub's transfer `Location` has not been observed yet. Leave a comment that points to the live contract mode (step 08).
- **`{ kind: 'unclassifiable' }`** for everything else: a missing or unparseable `Location`, another scheme, host or port, or credentials in the URL.

The caller maps `unclassifiable` to `unavailable{redirect}`. The rename URL is used only for the single retry. It never appears in a result or a log.

A status of `302`, `307` or `308` is treated like `301`. Any other `3xx` goes through `classifyRange` (`unavailable{redirect}`).

## Files to Change
- `backend/src/integrations/github-issue-redirect.ts` — new: `classifyIssueRedirect`.
