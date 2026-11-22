# Content canary sweep and unique-index logging

Add `issues-content-canary.db-spec.ts`. Seed a project name, a project description, an issue title and body, a GitHub issue title and body, and a repository owner and name, each carrying a distinct canary string. Then:

- run every route, refusals included (validation `400`, `404`, `409`, `429`), plus the reconcile job through success and failure outcomes;
- assert that no captured log line contains any content canary;
- assert that every `4xx` refusal produces only the access line, and no other log line, for that request.

Add `issues-unique-index.logging.db-spec.ts`. For each unique index of the Issues tables, among them the live project name per user, the repository per user's live project, and the link per (`user_id`, GitHub issue) and per issue, provoke the duplicate through its route, sequentially and through the existing race helpers. Assert the mapped `409` (or the shortcut's `200`), and that no log line contains the duplicated value. Reuse `duplicate-entry.ts`'s mapping list as the table, so a new index without a row fails.

If either sweep finds a leak, fix the logger call or the error mapping in production code. Most likely that means `issues-http-errors.ts` or the sync service's log fields, kept to the `security.md#what-may-be-logged` allowlist.

## Files to Change
- `backend/src/issues/tests/issues-content-canary.db-spec.ts`: new.
- `backend/src/issues/tests/issues-unique-index.logging.db-spec.ts`: new.
- `backend/src/issues/duplicate-entry.ts`: export the index list if it is not already reachable (no behaviour change).
- Production files under `backend/src/issues/`: only if a sweep uncovers a leak.
