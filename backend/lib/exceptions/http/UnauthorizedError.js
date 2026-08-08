import { AppError } from '../AppError.js';

/**
 * UnauthorizedError is thrown when authentication fails (unknown login
 * identifier or wrong credentials). The message is intentionally generic so
 * callers can't distinguish "unknown user" from "wrong password".
 * @author darthjee
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message);
  }
}

export { UnauthorizedError };
