/**
 * Serializes a User model instance into its public JSON view.
 * Never exposes passwordDigest.
 * @author darthjee
 */
class UserSerializer {
  #user;

  /**
   * @param {object} user - The User instance to serialize.
   */
  constructor(user) {
    this.#user = user;
  }

  /**
   * @returns {object} The plain JSON-serializable view of the user.
   */
  asJson() {
    return {
      id: this.#user.id,
      username: this.#user.username,
      email: this.#user.email,
    };
  }
}

export { UserSerializer };
