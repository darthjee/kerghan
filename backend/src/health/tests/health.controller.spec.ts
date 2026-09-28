import { INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CachePolicyInterceptor } from '../../core/cache-policy.interceptor.js';
import { HealthController } from '../health.controller.js';

describe('HealthController', () => {
  it('responds with a status ok payload', () => {
    const result = new HealthController().check();

    expect(result).toEqual({ status: 'ok' });
  });

  describe('GET /health.json cache headers', () => {
    let app: INestApplication;
    let response: request.Response;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: APP_INTERCEPTOR, useClass: CachePolicyInterceptor }],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
      response = await request(app.getHttpServer()).get('/health.json').expect(200);
    });

    afterAll(async () => {
      await app.close();
    });

    it('sets X-Skip-Cache so Tent never caches the health check', () => {
      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('sets Cache-Control: no-store', () => {
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
