# Extract shared in-memory repo
Create `backend/src/auth/tests/support/in-memory-repo.ts` exporting `matchesCondition` and `createInMemoryRepo<T extends { id?: number }>()` as a superset of the existing copies:

- `matchesCondition(rowValue, conditionValue)` — plain equality plus the FindOperator shapes `{ type: 'isNull' }`, `{ type: 'moreThan', value }` and `{ type: 'ilike', value }` (case-insensitive substring match after stripping `%`, as the admin spec's `find()` does today); unknown operators return `false`.
- `create`, `findOne` (single or array `where`), `findOneBy`, `find({ where?, order? })` (no `where` returns a copy of all rows; `order` sorts on the first key by date), `count({ where })`, `save` (assigns incrementing `id`, auto-fills `createdAt`, pushes on insert), `update` (by numeric id or criteria object), and the `createQueryBuilder().update().set().where().execute()` stub used by the atomic `approved → logged` claim.
- Carry over the explanatory comments from the existing copies (no live DB in CI; `createdAt` auto-fill mirrors `@CreateDateColumn`; the guarded-UPDATE simulation), and drop the "duplicated per e2e spec file, not shared" note.

Use `authorization-request.controller.e2e-test-support.ts`'s copy as the base, since it is already the superset, and fold in `ilike` from the admin spec.

## Files to Change
- `backend/src/auth/tests/support/in-memory-repo.ts` — new module holding the single `matchesCondition` + `createInMemoryRepo`.
