import type { SessionLookup, SessionUser } from '../../../core/session-lookup.js';
import type { RefreshToken } from '../../entities/refresh-token.entity.js';
import type { User } from '../../entities/user.entity.js';

// In-memory stand-in for `SessionService#findActiveSessionUser`, whose real
// query-builder join cannot run on the per-entity in-memory repos. Applies
// exactly the same rules over the repos' live rows: the refresh-token row
// with `sessionUuid === sid`, not revoked and not expired, joined to the
// user whose `id` is the row's `userId`. The real query's correctness is
// covered by `session.service.spec.ts`. Plugged into the e2e apps with
// `.overrideProvider(SESSION_LOOKUP)`.
export class InMemorySessionLookup implements SessionLookup {
  private readonly userRows: User[];
  private readonly refreshTokenRows: RefreshToken[];

  constructor(userRows: User[], refreshTokenRows: RefreshToken[]) {
    this.userRows = userRows;
    this.refreshTokenRows = refreshTokenRows;
  }

  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    const now = new Date();
    const session = this.refreshTokenRows.find(
      (row) => row.sessionUuid === sid && !row.revokedAt && row.expiresAt > now,
    );
    const user = session ? this.userRows.find((row) => row.id === session.userId) : undefined;

    return user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null;
  }
}
