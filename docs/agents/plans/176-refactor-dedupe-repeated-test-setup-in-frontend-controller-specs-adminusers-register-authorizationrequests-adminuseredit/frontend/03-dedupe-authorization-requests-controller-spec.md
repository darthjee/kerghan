# Dedupe AuthorizationRequestsControllerSpec
`#authorize` and `#deny` contain the same three cases: success clears the row error and reloads the list; a 400 stores the error against the row and does not reload; an expired session (client resolves `undefined`) does nothing. Generate them from one table, e.g. rows of `{ method, args, clientMethod, successResponse, errorMessage, rowStateBefore, expectedRowStateAfter }`, inside the existing `describe('#authorize')` / `describe('#deny')` titles (a loop that emits a `describe` per row, or a local helper called from each existing `describe`) so full spec names stay unchanged.

Keep each method's current per-row data exactly, since the two do not use identical inputs today: `authorize` is called with `('req-uuid', 'secret')` and `('req-uuid', 'wrong')`, asserts the client call args, and its 400 case starts from a row state `{ open: true, password: 'wrong' }` and expects `error` merged into it; `deny` is called with `('req-uuid')` and its 400 case starts from `{}`. The existing `buildController()` helper and the `#load` cases are unchanged.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/AuthorizationRequestsControllerSpec.js` — table-driven `#authorize`/`#deny` cases
