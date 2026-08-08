import { HandlerConfig } from '../../lib/server/HandlerConfig.js';

class SyncHandler {
  constructor(request, response, value) {
    this.request = request;
    this.response = response;
    this.value = value;
  }

  handle() {
    return this.value;
  }
}

class AsyncHandler {
  constructor(request, response, error) {
    this.request = request;
    this.response = response;
    this.error = error;
  }

  async handle() {
    throw this.error;
  }
}

describe('HandlerConfig', () => {
  it('instantiates the handler with the request, response, and extra parameters', () => {
    const request = {};
    const response = {};
    const config = new HandlerConfig(SyncHandler, 'extra-value');

    expect(config.handle(request, response)).toBe('extra-value');
  });

  it('propagates a rejected promise from an async handler instead of swallowing it', async () => {
    const error = new Error('boom');
    const config = new HandlerConfig(AsyncHandler, error);

    await expectAsync(config.handle({}, {})).toBeRejectedWith(error);
  });
});
