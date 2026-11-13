import { ArgumentsHost, HttpException } from '@nestjs/common';
import { HttpExceptionFilter } from '../../core/http-exception.filter.js';
import { LoggerService } from '../../core/logger.service.js';
import {
  addRateLimited,
  refreshCooldown,
  repositoryNotFound,
  repositorySourceUnusable,
} from '../repositories-http-errors.js';

interface Answer {
  status: number;
  headers: Record<string, string>;
  error: unknown;
}

/**
 * Runs the exception through the real error filter and returns what the client sees.
 * @param {HttpException} exception - The exception.
 * @returns {Answer} The status, headers and `error` body member.
 */
function render(exception: HttpException): Answer {
  const headers: Record<string, string> = {};
  const answer: Answer = { status: 0, headers, error: undefined };
  const response = {
    setHeader: (name: string, value: string) => { headers[name] = value; },
    status: (status: number) => { answer.status = status; return response; },
    json: (body: { error: unknown }) => { answer.error = body.error; },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;

  new HttpExceptionFilter({ error: jest.fn(), debug: jest.fn() } as unknown as LoggerService).catch(exception, host);

  return answer;
}

describe('repositories-http-errors', () => {
  it('answers 404 NOT_FOUND "Repository not found"', () => {
    expect(render(repositoryNotFound())).toEqual({
      status: 404,
      headers: {},
      error: { code: 'NOT_FOUND', message: 'Repository not found' },
    });
  });

  it('produces an identical body on every 404 call', () => {
    expect(render(repositoryNotFound())).toEqual(render(repositoryNotFound()));
    expect(repositoryNotFound().getResponse()).toEqual(repositoryNotFound().getResponse());
  });

  it('answers 409 REPOSITORY_SOURCE_UNUSABLE', () => {
    expect(render(repositorySourceUnusable())).toEqual({
      status: 409,
      headers: {},
      error: {
        code: 'REPOSITORY_SOURCE_UNUSABLE',
        message: 'The integration that sees this repository needs attention.',
      },
    });
  });

  it('answers 429 REPOSITORY_REFRESH_COOLDOWN with Retry-After and the body field', () => {
    expect(render(refreshCooldown(12.4))).toEqual({
      status: 429,
      headers: { 'Retry-After': '13' },
      error: {
        code: 'REPOSITORY_REFRESH_COOLDOWN',
        message: 'Repositories were synced recently; try again later',
        retryAfterSeconds: 13,
      },
    });
  });

  it('answers 429 REPOSITORY_ADD_RATE_LIMITED with Retry-After and the body field', () => {
    expect(render(addRateLimited(60))).toEqual({
      status: 429,
      headers: { 'Retry-After': '60' },
      error: {
        code: 'REPOSITORY_ADD_RATE_LIMITED',
        message: 'Too many repositories added; try again later',
        retryAfterSeconds: 60,
      },
    });
  });
});
