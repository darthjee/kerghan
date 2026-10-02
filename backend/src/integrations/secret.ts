import { inspect } from 'node:util';

// What every stringification of a `Secret` renders as.
export const REDACTED = '[REDACTED]';

/**
 * Immutable wrapper around a plaintext credential (or a JSON-serialisable
 * secret payload). Every way it can be stringified — `toString()`,
 * `toJSON()` (so `JSON.stringify`), template literals and `util.inspect`
 * (so `console.log` and the structured logger) — renders `[REDACTED]`.
 *
 * Only `reveal()` unwraps the value, and it is called only at the GitHub
 * client call site and at the encryption/decryption boundary (see
 * `docs/agents/specs/integrations/security.md#secrets-never-logged`).
 */
export class Secret<T = unknown> {
  readonly #value: T;

  /**
   * @param {T} value - The plaintext value to hide.
   */
  constructor(value: T) {
    this.#value = value;
    Object.freeze(this);
  }

  /**
   * Unwraps the plaintext value. Only the GitHub client call site and the
   * encryption service may call it.
   * @returns {T} The wrapped plaintext value.
   */
  reveal(): T {
    return this.#value;
  }

  /**
   * @returns {string} Always `[REDACTED]`.
   */
  toString(): string {
    return REDACTED;
  }

  /**
   * @returns {string} Always `[REDACTED]`, so `JSON.stringify` never leaks the value.
   */
  toJSON(): string {
    return REDACTED;
  }

  /**
   * `util.inspect` hook, used by `console.log` and the logger's console output.
   * @returns {string} Always `[REDACTED]`.
   */
  [inspect.custom](): string {
    return REDACTED;
  }
}
