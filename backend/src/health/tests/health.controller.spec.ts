import { HealthController } from '../health.controller.js';

describe('HealthController', () => {
  it('responds with a status ok payload', () => {
    const result = new HealthController().check();

    expect(result).toEqual({ status: 'ok' });
  });
});
