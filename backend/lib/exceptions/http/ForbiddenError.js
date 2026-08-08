import { AppError } from '../AppError.js';

/**
 * ForbiddenError is thrown when the caller is not allowed to perform the requested action.
 * @author darthjee
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message);
  }
}

export { ForbiddenError };
