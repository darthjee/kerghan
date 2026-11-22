# Unit and static specs

## Unit (with the no-network guard and `fetchMock`)

- **`github-issue-response.spec.ts`:**
  - every row of the step 02 classification, per operation;
  - `parseIssue`: valid, malformed, a pull request, a blank body becoming `null`, the title and body limits, and a `body` with CRLF kept verbatim;
  - `parseRenamedTo`: valid, percent-encoded, wrong host and over-long parts.
- **`github-issue-redirect.spec.ts`** covers every branch of `classifyIssueRedirect`:
  - a rename, with the same repository id and number;
  - a different id or number, which is `moved`;
  - another host, scheme or port, which is `unclassifiable`;
  - credentials, a query or a fragment in the URL;
  - a missing `Location`, and a relative `Location`.
- **`github-issue-client.service.spec.ts`:**
  - the paths, with encoding;
  - `If-None-Match`;
  - the `PATCH` body containing only the diff and never `state_reason`;
  - an extra field, `state_reason` or an empty diff throwing before `fetch`;
  - a rename followed once with the same body;
  - a second `301` becoming `unavailable{redirect}`;
  - an off-host `Location` sending no second request;
  - a timeout and a network error.
- **`integrations-github.service.spec.ts`** (extended), for `getIssue` and `probeIssues`:
  - a foreign or missing integration answers `integration_unusable` with no `fetch`;
  - a `pat` `401` sets `invalid`;
  - a `github_app` call mints with `{ issues: read, metadata: read }`;
  - logs carry only safe fields and never a title, body, URL or token (log capture with a canary title and body).
- **`integrations-github-issue-writer.service.spec.ts`:**
  - validation before any load or call;
  - the mint with `{ issues: write }`;
  - a `401` and a `403` (`forbidden`, which does not invalidate);
  - the same safe-log assertions.
- **The extracted runner:** the existing `integrations-github.service.spec.ts` cases for the listings pass unchanged, proving there is no behaviour change.

## Static

- **`integrations-writer-boundary.spec.ts`**, next to the Repositories module-boundary tooling under `backend/src/integrations/tests/`, or `src/repositories/tests/`, wherever `module-sources.ts`-style helpers live. It scans every `backend/src/**/*.ts` file outside `src/integrations/` and the test folders.
  - It fails when a file references `IntegrationsGithubIssueWriter`. The allowlist `WRITER_INJECTORS` is empty, with a comment saying #558 adds the issues sync service.
  - It includes a self-test showing that the matcher flags an import and a constructor injection.
- **`integrations-github-get-only.spec.ts`** asserts that `integrations-github.service.ts`, `github-repo-client.service.ts` and the read methods of `github-issue-client.service.ts` contain no `method:` other than `'GET'`. It also asserts that `PATCH` appears only in `github-issue-client.service.ts`'s `updateIssue` and is reached only from the writer. The token mint `POST` is a known, allowlisted exception, documented as such.

## Files to Change
- `backend/src/integrations/tests/github-issue-response.spec.ts` — new.
- `backend/src/integrations/tests/github-issue-redirect.spec.ts` — new.
- `backend/src/integrations/tests/github-issue-client.service.spec.ts` — new.
- `backend/src/integrations/tests/integrations-github.service.spec.ts` — the issue reads.
- `backend/src/integrations/tests/integrations-github-issue-writer.service.spec.ts` — new.
- `backend/src/integrations/tests/integrations-writer-boundary.spec.ts` — new (static).
- `backend/src/integrations/tests/integrations-github-get-only.spec.ts` — new (static).
