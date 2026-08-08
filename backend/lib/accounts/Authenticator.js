import bcrypt from 'bcryptjs';
import { UnauthorizedError } from '../exceptions/http/UnauthorizedError.js';

// A pre-computed bcrypt hash of a value nobody will ever submit, compared
// against when no user is found so lookups for unknown usernames take the
// same time as a wrong-password check (avoids trivial timing-based
// username enumeration).
const DUMMY_DIGEST = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1eLXfPJvXQF4RUOgtnJhmiQq6Zsy';

/**
 * Verifies a username/password pair against the User model.
 * @author darthjee
 */
class Authenticator {
  #userModel;

  /**
   * @param {object} userModel - The injected Sequelize User model.
   */
  constructor(userModel) {
    this.#userModel = userModel;
  }

  /**
   * Authenticates a username/password pair.
   * @param {object} credentials - The login credentials.
   * @param {string} credentials.username - The submitted username.
   * @param {string} credentials.password - The submitted plaintext password.
   * @returns {Promise<object>} The matching User instance.
   * @throws {UnauthorizedError} When the username is unknown or the password is wrong.
   */
  async authenticate({ username, password }) {
    const user = await this.#userModel.findOne({ where: { username } });
    const digest = user?.passwordDigest ?? DUMMY_DIGEST;
    const valid = await bcrypt.compare(password, digest);

    if (!user || !valid) {
      throw new UnauthorizedError('Invalid username or password');
    }

    return user;
  }
}

export { Authenticator };
