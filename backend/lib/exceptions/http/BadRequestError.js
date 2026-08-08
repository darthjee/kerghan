import { AppError } from '../AppError.js';

/**
 * BadRequestError is thrown when the request is malformed, e.g. missing
 * required parameters.
 * @author darthjee
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message);
  }
}

export { BadRequestError };
