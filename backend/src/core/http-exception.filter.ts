import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { categoryCodeFor, ErrorCodes, INTERNAL_ERROR_MESSAGE } from './error-codes.js';
import { LoggerService } from './logger.service.js';

/**
 * The `error` member of every error response body.
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: string[];
}

/**
 * The JSON body written for every error response.
 */
export interface ErrorResponseBody {
  error: ErrorPayload;
  statusCode: number;
  timestamp: string;
}

/**
 * The object shape Nest's `HttpException#getResponse()` may return: the
 * built-in `{ message, error, statusCode }` body, the `ValidationPipe`
 * variant with an array `message`, or a throw-site object carrying a
 * specific `code`.
 */
interface HttpExceptionResponse {
  code?: unknown;
  message?: unknown;
}

/**
 * Global catch-all exception filter (registered via `APP_FILTER`) that
 * reshapes every error into the standard body
 * `{ error: { code, message, details? }, statusCode, timestamp }`.
 *
 * - `HttpException`s keep their status; `error.code` is the throw site's
 *   specific `code` when given, otherwise the status's category code
 *   (`VALIDATION_FAILED` for `ValidationPipe` failures, whose message list is
 *   also exposed as `details`).
 * - Any other error answers `500`/`INTERNAL_ERROR` with a generic message;
 *   the real error and stack are logged, never sent to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger: LoggerService;

  /**
   * @param {LoggerService} logger - Logs unexpected (non-HTTP) errors.
   */
  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * Writes the standard error body for the caught exception.
   * @param {unknown} exception - The thrown value.
   * @param {ArgumentsHost} host - Nest's execution context, used to reach the HTTP response.
   * @returns {void}
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, error } = exception instanceof HttpException
      ? { status: exception.getStatus(), error: this.buildHttpPayload(exception) }
      : { status: HttpStatus.INTERNAL_SERVER_ERROR, error: this.buildInternalPayload(exception) };

    const body: ErrorResponseBody = { error, statusCode: status, timestamp: new Date().toISOString() };
    response.status(status).json(body);
  }

  /**
   * Builds the error payload for an `HttpException`.
   * @param {HttpException} exception - The HTTP exception.
   * @returns {ErrorPayload} The payload, with specific or category code.
   */
  private buildHttpPayload(exception: HttpException): ErrorPayload {
    const status = exception.getStatus();
    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return { code: categoryCodeFor(status), message: raw };
    }

    const { code, message } = raw as HttpExceptionResponse;
    const specificCode = typeof code === 'string' ? code : undefined;

    if (Array.isArray(message)) {
      const details = message.map(String);
      return { code: specificCode ?? ErrorCodes.VALIDATION_FAILED, message: details.join('; '), details };
    }

    return {
      code: specificCode ?? categoryCodeFor(status),
      message: typeof message === 'string' ? message : exception.message,
    };
  }

  /**
   * Logs an unexpected error and builds the generic `500` payload.
   * @param {unknown} exception - The thrown non-HTTP value.
   * @returns {ErrorPayload} The generic internal-error payload (no leaked details).
   */
  private buildInternalPayload(exception: unknown): ErrorPayload {
    const isError = exception instanceof Error;
    this.logger.error('unhandled exception', {
      error: isError ? exception.message : String(exception),
      name: isError ? exception.name : typeof exception,
      stack: isError ? exception.stack : undefined,
    });

    return { code: ErrorCodes.INTERNAL_ERROR, message: INTERNAL_ERROR_MESSAGE };
  }
}
