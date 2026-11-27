import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CachePolicyInterceptor } from '../../core/cache-policy.interceptor.js';
import { HttpExceptionFilter } from '../../core/http-exception.filter.js';
import { JwtGuard } from '../../core/jwt.guard.js';
import { LoggerService } from '../../core/logger.service.js';
import { SESSION_LOOKUP } from '../../core/session-lookup.js';
import { HealthController } from '../health.controller.js';
import { HealthService } from '../health.service.js';

const LIVENESS = { app: 'kerghan', status: 'ok', version: '9.8.7' };

function readinessBody(status: string, database: string, workers: string) {
  return { app: 'kerghan', status, version: '9.8.7', checks: { database, workers } };
}

describe('HealthController', () => {
  let liveness: jest.Mock;
  let checkReadiness: jest.Mock;

  beforeEach(() => {
    liveness = jest.fn().mockReturnValue(LIVENESS);
    checkReadiness = jest.fn();
  });

  it('delegates the liveness body to the service', () => {
    const service = { liveness } as unknown as HealthService;
    const result = new HealthController(service).check();

    expect(result).toBe(LIVENESS);
  });

  describe('HTTP routes', () => {
    let app: INestApplication;

    // The real global guard and exception filter, so the specs prove the probes are public and
    // that a 503 keeps the probe body.
    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: HealthService,
            useValue: {
              liveness: (): unknown => liveness(),
              checkReadiness: (): unknown => checkReadiness(),
            },
          },
          { provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor },
          { provide: APP_GUARD, useClass: JwtGuard },
          { provide: APP_FILTER, useClass: HttpExceptionFilter },
          { provide: JwtService, useValue: new JwtService({ secret: 'test-key' }) },
          { provide: ConfigService, useValue: { get: (): undefined => undefined } },
          { provide: SESSION_LOOKUP, useValue: { findActiveSessionUser: jest.fn() } },
          { provide: LoggerService, useValue: { debug: jest.fn(), error: jest.fn() } },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    describe('GET /health.json without a token', () => {
      let response: request.Response;

      beforeEach(async () => {
        response = await request(app.getHttpServer()).get('/health.json').expect(200);
      });

      it('responds with the identity, status and version', () => {
        expect(response.body).toEqual({ app: 'kerghan', status: 'ok', version: '9.8.7' });
      });

      it('does not run the readiness checks', () => {
        expect(checkReadiness).not.toHaveBeenCalled();
      });

      it('sets X-Skip-Cache so Tent never caches the health check', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('sets Cache-Control: no-store', () => {
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });

    describe.each([
      { status: 'ok', database: 'up', workers: 'up', code: 200 },
      { status: 'degraded', database: 'up', workers: 'down', code: 200 },
      { status: 'error', database: 'down', workers: 'up', code: 503 },
    ])('GET /ready.json without a token when the status is $status', ({ status, database, workers, code }) => {
      let response: request.Response;

      beforeEach(async () => {
        checkReadiness.mockResolvedValue(readinessBody(status, database, workers));
        response = await request(app.getHttpServer()).get('/ready.json');
      });

      it(`responds ${code}`, () => {
        expect(response.status).toBe(code);
      });

      it('returns exactly the probe body, not the standard error shape', () => {
        expect(response.body).toEqual(readinessBody(status, database, workers));
      });

      it('sets X-Skip-Cache: true', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });

      it('sets Cache-Control: no-store', () => {
        expect(response.headers['cache-control']).toBe('no-store');
      });
    });
  });
});
