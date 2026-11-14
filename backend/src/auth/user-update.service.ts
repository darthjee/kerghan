import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

/** The `{ username, email, githubHandle }` shape returned to the caller after an account update. */
export interface AccountSummary {
  username: string;
  email: string;
  githubHandle: string | null;
}

/** The changes `UserUpdateService#applyUserUpdate` may apply. */
export interface UserChanges {
  username?: string;
  email?: string;
  newPassword?: string;
  githubHandle?: string | null;
}

/**
 * Projects a user row onto the account summary returned to its owner.
 * @param {User} user - The user row.
 * @returns {AccountSummary} The user's username, email and GitHub handle.
 */
export function toAccountSummary(user: User): AccountSummary {
  return { username: user.username, email: user.email, githubHandle: user.githubHandle ?? null };
}

/**
 * Applies and persists `username`/`email`/password (and, for the account
 * edit only, `githubHandle`) changes to an
 * already-loaded user row. Split out from `AuthService` (which already
 * handles the availability check via `assertAvailableForUpdate`) rather
 * than growing that file past the project's 300-line-per-file convention.
 * Shared by `AccountService#updateAccount` (self-service, confirmed by the
 * caller's current password) and `AdminService#editUser` (admin-driven,
 * no current-password confirmation) — both validate availability
 * beforehand via `AuthService#assertAvailableForUpdate` and differ only in
 * how the target user and permission are established.
 */
@Injectable()
export class UserUpdateService {
  private readonly userRepository: Repository<User>;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   */
  constructor(@InjectRepository(User) userRepository: Repository<User>) {
    this.userRepository = userRepository;
  }

  /**
   * Applies a set of account changes to a user: mutates the provided
   * `username`/`email` fields, hashes and stores a new password when
   * given, sets `githubHandle` when given (`null` clears it; the admin path
   * never passes it), and persists the result.
   * @param {User} user - The user row to update (already loaded by the caller).
   * @param {object} changes - The fields to change.
   * @param {string} [changes.username] - The new username, when being changed.
   * @param {string} [changes.email] - The new email, when being changed.
   * @param {string} [changes.newPassword] - The new plaintext password, when being changed.
   * @param {string | null} [changes.githubHandle] - The new, already-normalised
   *   GitHub handle (`null` clears it), when being changed.
   * @returns {Promise<AccountSummary>} The user's resulting username, email and GitHub handle.
   */
  async applyUserUpdate(user: User, changes: UserChanges): Promise<AccountSummary> {
    if (changes.username) {
      user.username = changes.username;
    }

    if (changes.email) {
      user.email = changes.email;
    }

    if (changes.newPassword) {
      user.passwordDigest = await bcrypt.hash(changes.newPassword, 10);
    }

    if (changes.githubHandle !== undefined) {
      user.githubHandle = changes.githubHandle;
    }

    const saved = await this.userRepository.save(user);

    return toAccountSummary(saved);
  }
}
