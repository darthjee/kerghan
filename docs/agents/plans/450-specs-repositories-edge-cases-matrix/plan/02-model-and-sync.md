# model.md and sync.md rules

Write the issue's rules that live in `model.md` and `sync.md`.

**`model.md`:**

- **`#row-statuses`:**
  - Added needs a source row from a source whose status is `ok` or `page_cap_reached`;
  - Unknown covers an added repo whose remaining source rows all belong to not-ok sources
    (`error`, `invalid_credentials`, `rate_limited`, `not_found`, `pending`);
  - remove the "page cap … #450" sentence;
  - mention that the end-of-sync link fill makes a private repo with an empty link Added again.
- **`#repositories_source_statuses`:** add `not_found` (handle only).
- **`#validation`:** replace "the exact status is #450's edge-case matrix" with `not_found`.
- **`#logical-foreign-keys`:** replace the open marker with a "User deletion" subsection:
  - the awaited `user.deleted` event (`UserDeletedEvent { userId }`, emitted with `emitAsync`
    after the delete commits);
  - the listener deletes the user's rows from the five tables in one transaction;
  - best-effort, registered at boot;
  - why there is no physical cascade;
  - the integrations cascade emits no `integration.deleted`.
- **`#handle-changes`:**
  - the run's own reconciliation only updates an existing sync-state row (no row ⇒ the run
    stops);
  - "the rest of the mid-sync matrix stays #450's" becomes a link to `edge-cases.md`.
- **`#private-metadata-lifecycle`:** "the rest of the edge-case matrix stays with #450" becomes a
  link.
- **Required tests:** the issue's `model.md` entries (pending ⇒ Unknown, `not_found` handle ⇒
  Unknown, `user.deleted` listener).

**`sync.md`:**

- **`#handle-credential`:** a `404` ⇒ `not_found`, retried every sync, no fallback; drop "for
  now; #450 may add".
- **`#write-path`:**
  - **end of a source on the cap:** delete its source rows and page rows past the cap;
  - **end of the sync:** a new **link fill** subsection with its own heading
    (`#link-fill`), after the safety net and before pruning:
    - only added, private repos with an empty or dangling link (`IS NULL OR NOT IN
      (:userIntegrationIds)`);
    - the oldest usable integration holding a row from an `ok` or `page_cap_reached` source;
    - never changes a set, valid link;
  - **a run never creates the sync-state row.**
- **A missing integration:** `integration_unusable` with reason `missing` ⇒ stop the source with
  no status.
- **`#partial-failures` and `#per-source`:** the page cap counts as `ok`; replace "nothing past
  the cap is deleted".
- **`#conditional-requests`:** the page whose stored `has_next` is `false` is requested without
  `If-None-Match`, and the reason why.
- **`#edge-cases`:** replace the open marker with a one-line pointer to `edge-cases.md`.
- **Required tests:**
  - replace the "nothing past the cap is deleted" test;
  - add the issue's `sync.md` entries: the cap trim, the unconditional last page, a full last
    page then a new repo, `not_found`, no status for a deleted integration, the link fill, a run
    never creating the row.

## Files to Change

- `docs/agents/specs/repos/model.md` — row statuses, statuses table, user deletion, handle
  reconciliation, links, tests.
- `docs/agents/specs/repos/sync.md` — handle `404`, page cap, link fill, missing integration,
  unconditional last page, edge-cases pointer, tests.
