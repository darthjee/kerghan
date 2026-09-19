import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { SKIP_CACHE_HEADER } from '../../auth/auth-response.js';
import { SkipCacheInterceptor } from '../skip-cache.interceptor.js';

function contextFor(set: jest.Mock): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => ({ set }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('SkipCacheInterceptor', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let interceptor: SkipCacheInterceptor;
  let set: jest.Mock;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    interceptor = new SkipCacheInterceptor(reflector as unknown as Reflector);
    set = jest.fn();
  });

  describe('when the route has no @SkipCache() metadata', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(false);
    });

    it('does not set the header', (done) => {
      interceptor.intercept(contextFor(set), handlerReturning({ ok: true })).subscribe(() => {
        expect(set).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe('when the route is @SkipCache()', () => {
    beforeEach(() => {
      reflector.getAllAndOverride.mockReturnValue(true);
    });

    it('sets the X-Skip-Cache header to true', (done) => {
      interceptor.intercept(contextFor(set), handlerReturning({ ok: true })).subscribe(() => {
        expect(set).toHaveBeenCalledWith(SKIP_CACHE_HEADER, 'true');
        done();
      });
    });

    it('passes the handler response through unchanged', (done) => {
      interceptor.intercept(contextFor(set), handlerReturning({ ok: true })).subscribe((value) => {
        expect(value).toEqual({ ok: true });
        done();
      });
    });
  });
});
