# Shared pieces: error map, number parser, re-read scheduler, saved signal

These are the pure building blocks that the later steps compose. Each one gets its own unit spec.

- **Error map.** Add two overrides to `errorMessages.js`:
  - `GITHUB_ISSUE_ALREADY_LINKED`: "This GitHub issue is already linked", with a link to `ProjectPaths.issue(meta.projectId, meta.issueId)`. The ids pass through the uuid guard, and an invalid id gives the message without the link.
  - `GITHUB_CREDENTIAL_UNUSABLE`: the reason sentence of `meta.reason` (`no_credential`, `credential_invalid`, `forbidden`, taken from the presenter's table in step 02), plus a "Fix it in Integrations" link to `#/account/integrations`.

  Add a predicate for each code the flows branch on: `ISSUE_ATTACH_CONFIRMATION_REQUIRED`, `ISSUE_ALREADY_LINKED`, `ISSUE_NOT_LINKED`, `ISSUE_UNLINK_HAS_UNSENT_CHANGES` and `ISSUE_LINK_GONE`.
- **`issueNumberInput.js`.** `parse(raw, repository)` returns `{ number }` or `{ error }`:
  - It accepts `12`, `#12` and `https://github.com/<owner>/<name>/issues/12`, with the input trimmed.
  - The number must be a positive integer within the API's range.
  - A URL of another repository, compared case-insensitively with `repository.fullName`, gives "This issue is not in <owner/name>".
  - Anything else gives "Enter an issue number or GitHub issue URL".
- **`BoundedRereadController.js`.** It takes `{ read, onIssue, onDone }` and the trigger's issue.
  - It schedules reads at 2 s, 5 s and 10 s after the response.
  - It stops early when `link.lastSyncedAt` is later than the trigger's, or when `link.states` differs (by order and content).
  - It stops quietly after the third read.
  - A `404` from a read calls `onNotFound`, and other errors are ignored.
  - `dispose()` clears the timers.
  - It runs only for a linked, non-`gone` issue. `shouldReread(issue)` is exported for the callers.
- **`FocusRereadThrottle.js`.** It wraps a `reread` callback with a 30 s throttle (P4) on an injected clock. It is attached to `window` `focus` through a hook modelled on `useWindowFocusRecheck`, and `dispose()` removes the listener.
- **`savedIssueSignal.js`.** A module-level one-shot: `record(issueId, issue)` and `consume(issueId)`. `consume` returns the issue once, and only for the matching id, then clears. It does nothing with storage.

## Files to Change
- `frontend/assets/js/components/resources/projects/errors/errorMessages.js`: the two overrides and the predicates
- `frontend/assets/js/components/resources/issues/link/issueNumberInput.js` (new)
- `frontend/assets/js/components/resources/issues/sync/BoundedRereadController.js` (new)
- `frontend/assets/js/components/resources/issues/sync/FocusRereadThrottle.js` and `useFocusReread.js` (new)
- `frontend/assets/js/components/resources/issues/sync/savedIssueSignal.js` (new)
- `frontend/specs/assets/js/components/resources/...`: one spec per file above, with `jasmine.clock()` for the timers (the 2/5/10 s reads, early stop, quiet stop, dispose, the 30 s throttle)
