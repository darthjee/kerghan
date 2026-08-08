import { BadRequestError } from '../../exceptions/http/BadRequestError.js';
import { UserSerializer } from '../../serializers/UserSerializer.js';
import { RequestHandler } from '../RequestHandler.js';

/**
 * Executes request-handling behaviour for the login route: authenticates a
 * username/password pair, starts a session, and responds with the user.
 * @author darthjee
 */
class LoginHandler extends RequestHandler {
  #request;
  #response;
  #authenticator;

  /**
   * @param {object} request - The Express request object.
   * @param {object} response - The Express response object.
   * @param {object} authenticator - The injected Authenticator domain class.
   */
  constructor(request, response, authenticator) {
    super();
    this.#request = request;
    this.#response = response;
    this.#authenticator = authenticator;
  }

  /**
   * Authenticates the request body and responds with the logged-in user.
   * @returns {Promise<void>}
   * @throws {BadRequestError} When username/password are missing from the body.
   */
  async handle() {
    const { username, password } = this.#request.body ?? {};

    if (!username || !password) {
      throw new BadRequestError('username and password are required');
    }

    const user = await this.#authenticator.authenticate({ username, password });

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

export { LoginHandler };
