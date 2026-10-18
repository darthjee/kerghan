import { ConflictException } from '@nestjs/common';
import { Not, Repository } from 'typeorm';
import { ErrorCodes } from '../core/error-codes.js';
import { User } from './entities/user.entity.js';

// Specific error code attached to the `409` thrown when a field's value is taken.
const TAKEN_CODES = { username: ErrorCodes.USERNAME_TAKEN, email: ErrorCodes.EMAIL_TAKEN } as const;

/**
 * Checks that neither `username` nor `email` belongs to an existing user
 * (registration).
 * @param {Repository<User>} userRepository - The Auth module's user repository.
 * @param {string} username - Candidate username.
 * @param {string} email - Candidate email.
 * @returns {Promise<void>} Resolves once both values are confirmed available.
 * @throws {ConflictException} `'<field> is not available'` (`USERNAME_TAKEN`/`EMAIL_TAKEN`).
 */
export async function assertAvailable(
  userRepository: Repository<User>,
  username: string,
  email: string,
): Promise<void> {
  const existing = await userRepository.findOne({ where: [{ username }, { email }] });

  if (!existing) {
    return;
  }

  const field = existing.username === username ? 'username' : 'email';
  throw new ConflictException({ code: TAKEN_CODES[field], message: `${field} is not available` });
}

/**
 * Checks that `value` is not already used for `field` by any user other than
 * `excludeUserId` (account updates).
 * @param {Repository<User>} userRepository - The Auth module's user repository.
 * @param {'username' | 'email'} field - The field being changed.
 * @param {string} value - Candidate value.
 * @param {number} excludeUserId - Id of the user updating their account, excluded from the lookup.
 * @param {string} message - The conflict message.
 * @returns {Promise<void>} Resolves once the value is confirmed available.
 * @throws {ConflictException} With `message` (`USERNAME_TAKEN`/`EMAIL_TAKEN`).
 */
export async function assertFieldAvailable(
  userRepository: Repository<User>,
  field: 'username' | 'email',
  value: string,
  excludeUserId: number,
  message: string,
): Promise<void> {
  const existing = await userRepository.findOne({ where: { [field]: value, id: Not(excludeUserId) } });

  if (existing) {
    throw new ConflictException({ code: TAKEN_CODES[field], message });
  }
}
