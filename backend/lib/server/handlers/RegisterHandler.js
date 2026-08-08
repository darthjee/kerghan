import { BadRequestError } from '../../exceptions/http/BadRequestError.js';
import { UserSerializer } from '../../serializers/UserSerializer.js';
import { RequestHandler } from '../RequestHandler.js';

/**
 * Executes request-handling behaviour for the register route: creates a new
 * user account, starts a session, and responds with the user.
 * @author darthjee
 */
class RegisterHandler extends RequestHandler {
  #request;
  #response;
  #registrar;

  /**
   * @param {object} request - The Express request object.
   * @param {object} response - The Express response object.
   * @param {object} registrar - The injected Registrar domain class.
   */
  constructor(request, response, registrar) {
    super();
    this.#request = request;
    this.#response = response;
    this.#registrar = registrar;
  }

  /**
   * Validates the request body, registers the user, and responds with the
   * newly created account.
   * @returns {Promise<void>}
   * @throws {BadRequestError} When required fields are missing or the
   *   password confirmation does not match.
   */
  async handle() {
    const {
      username,
      email,
      password,
      password_confirmation: passwordConfirmation,
    } = this.#request.body ?? {};

    if (!username || !email || !password || !passwordConfirmation) {
      throw new BadRequestError('username, email, password and password_confirmation are required');
    }
    if (password !== passwordConfirmation) {
      throw new BadRequestError('password and password_confirmation do not match');
    }

    const user = await this.#registrar.register({ username, email, password });

    await this.#regenerateSession();
    this.#request.session.userId = user.id;
    this.#response.status(200).json(new UserSerializer(user).asJson());
  }

  /**
   * Regenerates the session id (fixation protection) before assigning it.
   * @returns {Promise<void>}
   */
  #regenerateSession() {
    return new Promise((resolve, reject) => {
      this.#request.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
  }
}

export { RegisterHandler };
