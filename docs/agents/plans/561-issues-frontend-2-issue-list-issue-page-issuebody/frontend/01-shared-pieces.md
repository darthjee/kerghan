# Shared pieces: error codes, countdown, issue paths and validators
This step builds the small modules that every later step uses.

- **Error map.** Extend `components/resources/projects/errors/errorMessages.js`:
  - `ISSUE_LINKED` maps to "Unlink this issue before deleting it".
  - `ISSUES_LIMIT_REACHED` and `ISSUE_EDIT_RATE_LIMITED` are form-level and show the API message.
  - The three rate-limit codes (`ISSUE_EDIT_RATE_LIMITED`, `ISSUE_LINK_RATE_LIMITED`, `GITHUB_RATE_LIMITED`) are flagged as rate limits. `describe` returns `retryAfterSeconds` for them, taken from `ApiError.retryAfterSeconds`.
  - Add `isIssueNotFound(error)`, a `404` on an issue route, mirroring `isProjectNotFound`.
- **Rate-limit countdown.** Add `components/common/forms/RateLimitCountdownController.js` and a `useRateLimitCountdown` hook. The controller:
  - starts from `retryAfterSeconds`, ticks every second with `setTimeout` or `setInterval`, and exposes `{ active, secondsLeft, label: 'Try again in N s' }`
  - re-enables at 0 and never resubmits
  - clears its timer on dispose (unmount)
  - treats a missing or invalid `retryAfterSeconds` as not active

  The UI rule applies to all three codes, so #562 only wires it.
- **Issue paths.** Extend `components/resources/projects/paths.js` with `issue(projectId, issueId)`, `newIssue(projectId)`, `editIssue(projectId, issueId)` and `issues(projectId, query)`. The last one goes through `ListQuery.toHash` with `states: ['open', 'closed', 'all']`. Every id is `encodeURIComponent`-ed (S3).
- **Validators.** Add `utils/validation/issueValidators.js`:
  - the title is required, 1 to 256 code points after trimming
  - the body is at most 65536 code points and is never trimmed

  They mirror `projectValidators.js`.

Specs:

- every new error code, including `retryAfterSeconds` and its absence
- the countdown with `jasmine.clock()`: label, tick, re-enable at 0, no resubmit, timer cleared on dispose
- the paths, encoding included
- the validator limits, including a 4-byte character counted once

## Files to Change
- `frontend/assets/js/components/resources/projects/errors/errorMessages.js` — add the issue and rate-limit codes and `isIssueNotFound`
- `frontend/assets/js/components/common/forms/RateLimitCountdownController.js` — new shared countdown
- `frontend/assets/js/components/common/forms/hooks/useRateLimitCountdown.js` — new hook
- `frontend/assets/js/components/resources/projects/paths.js` — issue hashes
- `frontend/assets/js/utils/validation/issueValidators.js` — new
- `frontend/specs/assets/js/...` — matching specs for each file
