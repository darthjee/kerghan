# Dedupe repeated cases and the abuse-guard clone
1. **`authorization-request.service.authorize.spec.ts`** (jscpd clone at original lines 98-108 ↔ 113-123): the "when the row is not open" and "when the row is past its expiresAt" blocks (and likely the "wrong password" / "belongs to another user" siblings) all assert `rejects.toThrow(new BadRequestException('Unable to authorize this request'))` and differ only in the row returned by `findOneBy` and the password. Fold the ones that differ only in inputs into an `it.each` table (name, row builder, password), keeping the pre-existing `describe`/`it` names readable; leave the ones with extra assertions (e.g. "does not emit an event") as they are or fold them in only if the assertions stay identical.
2. **`authorization-request.service.create.spec.ts`** (jscpd clone at original lines 126-138 ↔ 165-176): the per-IP and per-username "at the configured limit" blocks repeat the same "does not persist a row" body and differ only in which `count` mock returns 5. Extract a small local builder (e.g. `mockCountAtLimit(field: 'requestIp' | 'username')`) and/or an `it.each` over the two fields so the shared `save`-not-called assertion is written once; keep the assertions that are unique to one block (e.g. "does not emit", "still returns the same shape") where they are.
3. **Abuse-guard clone** (`authorization-request-abuse-guard.service.spec.ts` ~58-64 ↔ `authorization-request.service.create.spec.ts` ~196-202): replace the duplicated `count` assertion pair in both specs with `expectBothCreateCountsComputed(...)` from step 01.

Every original assertion must still run with the same arguments; only the boilerplate around them may change.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.authorize.spec.ts` — parameterise the repeated rejection cases.
- `backend/src/auth/tests/authorization-request.service.create.spec.ts` — extract the count-at-limit builder and use the shared count assertion helper.
- `backend/src/auth/tests/authorization-request-abuse-guard.service.spec.ts` — use the shared count assertion helper.
