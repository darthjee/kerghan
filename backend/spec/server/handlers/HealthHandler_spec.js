import { HealthHandler } from '../../../lib/server/handlers/HealthHandler.js';

describe('HealthHandler', () => {
  it('responds with 200 and a status ok payload', () => {
    const request = {};
    const response = jasmine.createSpyObj('response', ['status', 'json']);
    response.status.and.returnValue(response);

    new HealthHandler(request, response).handle();

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ status: 'ok' });
  });
});
