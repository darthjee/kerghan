# Issue response parsing and classification

Add the pure half of the issue client, mirroring `github-repo-response.ts`. Rate limits are read from headers only, and no body is parsed for a message.

Create `backend/src/integrations/github-issue-response.ts`:

- **`classifyIssueResponse(operation, status, rateLimit, authenticated, clock)`** returns `null` for a `200`, whose body is parsed next. Otherwise:
  - a rate limit (the existing `isRateLimitAnswer` / `resetAtFor`) is `rate_limited{resetAt}`;
  - `304` is `not_modified` for `issue`, and `unexpected` for the probe and the write;
  - `401` is `invalid_credentials`;
  - a `403` that is not a rate limit is `forbidden` (its own kind, not `unavailable{forbidden}`);
  - `404` is `not_found`;
  - `410` is `gone` for `issue` and `issue_update`, and `unexpected` for the probe;
  - `422` on the write is `unavailable{unexpected}`, because the allowlisted body should never trigger it;
  - `3xx` is handed to the redirect step (step 03) and never classified here;
  - everything else goes through `classifyRange` (`5xx` is `server_error`, the rest is `unexpected`).
- **`parseIssue(raw)`** returns a `GithubIssue`, or `null` when the object is malformed:
  - `id` and `number` are safe positive integers;
  - `title` is a string of at most 256 characters, and `body` is a string, `null` or absent, of at most 65536 characters;
  - `state` is `open` or `closed`;
  - `updated_at` is a valid ISO date;
  - `isPullRequest` is `pull_request !== undefined`.

  A malformed `200` is `unavailable{unexpected}`.
- **`parseRenamedTo(raw)`** reads `repository_url`. It must have the form `https://api.github.com/repos/{owner}/{name}`, with `owner` of at most 39 characters and `name` of at most 100 (the existing bounds), and the parts are URL-decoded. It returns `{ owner, name }`, or `null`.
- **The probe's `200` body** must be a JSON array, whatever its content. Anything else is `unexpected`.

The body caps are 128 KiB for an issue (a 65536-character body can take up to 4 bytes per character in UTF-8, plus metadata; size the cap to fit) and 64 KiB for the probe. Export them as constants.

## Files to Change
- `backend/src/integrations/github-issue-response.ts` — new: classification, `parseIssue`, `parseRenamedTo` and the body caps.
- `backend/src/integrations/github-repo-response.ts` — export `asObject`, `isGithubId` and `isBoundedString` (or move them to `github-http.ts`) for reuse.
