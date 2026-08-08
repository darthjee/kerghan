import bcrypt from 'bcryptjs';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { BadRequestError } from '../exceptions/http/BadRequestError.js';

/**
 * Creates a new User account, hashing its password before persisting.
 * @author darthjee
 */
class Registrar {
  #userModel;

  /**
   * @param {object} userModel - The injected Sequelize User model.
   */
  constructor(userModel) {
    this.#userModel = userModel;
  }

  /**
   * Registers a new user.
   * @param {object} params - The registration params.
   * @param {string} params.username - The desired username.
   * @param {string} params.email - The account email.
   * @param {string} params.password - The plaintext password.
   * @returns {Promise<object>} The created User instance.
   * @throws {BadRequestError} When the username/email are taken or the email is malformed.
   */
  async register({ username, email, password }) {
    const passwordDigest = await bcrypt.hash(password, 10);

    try {
      return await this.#userModel.create({ username, email, passwordDigest });
    } catch (e) {
      throw this.#toBadRequestError(e);
    }
  }

  /**
   * Maps a Sequelize creation error into a BadRequestError with a
   * field-specific message, rethrowing anything unrecognized as-is.
   * @param {Error} e - The error raised by the User model's create call.
   * @returns {Error} The error to throw.
   */
  #toBadRequestError(e) {
    if (e instanceof UniqueConstraintError) {
      const field = e.errors?.[0]?.path;
      return new BadRequestError(`${field} is not available`);
    }

    if (e instanceof ValidationError) {
      const message = e.errors?.[0]?.message;
      return new BadRequestError(message);
    }

    return e;
  }
}

export { Registrar };
