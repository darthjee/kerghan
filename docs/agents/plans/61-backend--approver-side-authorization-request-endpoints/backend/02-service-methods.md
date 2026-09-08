# Service methods: listOpenForUser, authorize, deny

Add the three approver-side business-logic methods to the existing `AuthorizationRequestService`
(`backend/src/auth/authorization-request.service.ts`), alongside `create`/`poll`. Inject nothing
new — `authorizationRequestRepository`, `userRepository` and `eventEmitter` are already
constructor-injected.

## Files to Change

- `backend/src/auth/authorization-request.service.ts`:
  - `listOpenForUser(userId: number): Promise<{ uuid, requestIp, requestUserAgent, createdAt,
    expiresAt }[]>` — `authorizationRequestRepository.find({ where: { userId, status: 'open',
    expiresAt: MoreThan(new Date()) }, order: { createdAt: 'DESC' } })`, mapped to the returned
    shape (never leak `id`, `pollTokenHash`, `username`, or `approvedByUserId`). `userId: null`
    rows and other users' rows are excluded by the `WHERE` clause itself.
  - `authorize(uuid: string, approverUserId: number, password: string): Promise<void>` — load the
    row by `uuid`; load the approver via `userRepository.findOneBy({ id: approverUserId })`.
    Throw one uniform `BadRequestException` (single shared message constant, e.g. `'Unable to
    authorize this request'`) when: the row is missing, `row.userId !== approverUserId`,
    `row.status !== 'open'`, `row.expiresAt < new Date()`, or `bcrypt.compare(password,
    approver.passwordDigest)` is `false`. On success: `authorizationRequestRepository.update(row.id,
    { status: 'approved', approvedByUserId: approverUserId, resolvedAt: new Date() })`, then emit
    `authorization-request.approved` with `new AuthorizationRequestApprovedEvent(uuid,
    approverUserId)`.
  - `deny(uuid: string, approverUserId: number): Promise<void>` — load the row by `uuid`; throw the
    same uniform `BadRequestException` when the row is missing, `row.userId !== approverUserId`, or
    `row.status !== 'open'` (no expiry check — see `backend.md`'s Notes). On success:
    `authorizationRequestRepository.update(row.id, { status: 'denied', resolvedAt: new Date() })`,
    then emit `authorization-request.denied` with `new AuthorizationRequestDeniedEvent(uuid,
    approverUserId)`.
  - Import `MoreThan` from `typeorm`, `BadRequestException` from `@nestjs/common`, `bcrypt` from
    `bcryptjs` (same import already used in `auth.service.ts`), and the two new event classes.
