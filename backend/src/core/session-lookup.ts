/**
 * Injection token for the `SessionLookup` implementation. `core/` never
 * imports `auth/`, so `JwtGuard` depends on this core-owned token and
 * interface while `AuthModule` provides and exports the implementation
 * (dependency inversion across the core/auth boundary).
 */
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');

/**
 * The user of an active session, as returned by `SessionLookup`. A
 * core-owned shape, so `core/` needs no import of the Auth module's `User`
 * entity. `id` is the session row's `userId`.
 */
export interface SessionUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

/**
 * Loads the user behind an access token's session (`sid` claim), used by
 * `JwtGuard` on every authenticated request. Implementations must return a
 * user only for an **active** session — its refresh-token row not revoked
 * and not expired — and `null` otherwise. A storage error must propagate
 * (never be turned into `null`), so the guard answers `500`, not `401`.
 */
export interface SessionLookup {
  /**
   * Finds the user of the active session identified by `sid`.
   * @param {string} sid - The session UUID (the access token's `sid` claim).
   * @returns {Promise<SessionUser | null>} The session's user, or `null`
   *   when no active session has that UUID.
   */
  findActiveSessionUser(sid: string): Promise<SessionUser | null>;
}
