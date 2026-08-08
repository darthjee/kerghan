import { BadRequestError } from '../../../lib/exceptions/http/BadRequestError.js';
import { UnauthorizedError } from '../../../lib/exceptions/http/UnauthorizedError.js';
import { LoginHandler } from '../../../lib/server/handlers/LoginHandler.js';

describe('LoginHandler', () => {
  let request;
  let response;
  let authenticator;

  beforeEach(() => {
    request = {
      body: { username: 'darthjee', password: 'correct-password' },
      session: { regenerate: jasmine.createSpy().and.callFake((cb) => cb()) },
    };
    response = jasmine.createSpyObj('response', ['status', 'json', 'set']);
    response.status.and.returnValue(response);
    response.set.and.returnValue(response);
    authenticator = jasmine.createSpyObj('authenticator', ['authenticate']);
  });

  describe('when the credentials are valid', () => {
    const user = { id: 42, username: 'darthjee', email: 'darthjee@example.com' };

    beforeEach(() => {
      authenticator.authenticate.and.resolveTo(user);
    });

    it('responds 200 with the serialized user', async () => {
      await new LoginHandler(request, response, authenticator).handle();

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        id: 42,
        username: 'darthjee',
        email: 'darthjee@example.com',
      });
    });

    it('sets the X-Skip-Cache header, so the proxy never caches a session-bound response', async () => {
      await new LoginHandler(request, response, authenticator).handle();

      expect(response.set).toHaveBeenCalledWith('X-Skip-Cache', 'true');
    });

    it('regenerates the session and stores the user id', async () => {
      await new LoginHandler(request, response, authenticator).handle();

      expect(request.session.regenerate).toHaveBeenCalled();
      expect(request.session.userId).toBe(42);
    });
  });

  describe('when username or password is missing from the body', () => {
    beforeEach(() => {
      request.body = { username: 'darthjee' };
    });

    it('rejects with BadRequestError without authenticating', async () => {
      await expectAsync(
        new LoginHandler(request, response, authenticator).handle()
      ).toBeRejectedWithError(BadRequestError, 'username and password are required');

      expect(authenticator.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('when the credentials are invalid', () => {
    beforeEach(() => {
      authenticator.authenticate.and.rejectWith(new UnauthorizedError('Invalid username or password'));
    });

    it('propagates the UnauthorizedError', async () => {
      await expectAsync(
        new LoginHandler(request, response, authenticator).handle()
      ).toBeRejectedWithError(UnauthorizedError, 'Invalid username or password');
    });
  });
});
