import { BadRequestError } from '../../../lib/exceptions/http/BadRequestError.js';
import { RegisterHandler } from '../../../lib/server/handlers/RegisterHandler.js';

describe('RegisterHandler', () => {
  let request;
  let response;
  let registrar;

  beforeEach(() => {
    request = {
      body: {
        username: 'darthjee',
        email: 'darthjee@example.com',
        password: 'my-password',
        password_confirmation: 'my-password',
      },
      session: { regenerate: jasmine.createSpy().and.callFake((cb) => cb()) },
    };
    response = jasmine.createSpyObj('response', ['status', 'json', 'set']);
    response.status.and.returnValue(response);
    response.set.and.returnValue(response);
    registrar = jasmine.createSpyObj('registrar', ['register']);
  });

  describe('when the submission is valid', () => {
    const user = { id: 42, username: 'darthjee', email: 'darthjee@example.com' };

    beforeEach(() => {
      registrar.register.and.resolveTo(user);
    });

    it('responds 200 with the serialized user', async () => {
      await new RegisterHandler(request, response, registrar).handle();

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        id: 42,
        username: 'darthjee',
        email: 'darthjee@example.com',
      });
    });

    it('regenerates the session and stores the user id', async () => {
      await new RegisterHandler(request, response, registrar).handle();

      expect(request.session.regenerate).toHaveBeenCalled();
      expect(request.session.userId).toBe(42);
    });

    it('sets the X-Skip-Cache header, so the proxy never caches a session-bound response', async () => {
      await new RegisterHandler(request, response, registrar).handle();

      expect(response.set).toHaveBeenCalledWith('X-Skip-Cache', 'true');
    });

    it('registers with the submitted username, email and password', async () => {
      await new RegisterHandler(request, response, registrar).handle();

      expect(registrar.register).toHaveBeenCalledWith({
        username: 'darthjee',
        email: 'darthjee@example.com',
        password: 'my-password',
      });
    });
  });

  describe('when a required field is missing from the body', () => {
    beforeEach(() => {
      request.body = { username: 'darthjee', email: 'darthjee@example.com' };
    });

    it('rejects with BadRequestError without registering', async () => {
      await expectAsync(
        new RegisterHandler(request, response, registrar).handle()
      ).toBeRejectedWithError(
        BadRequestError,
        'username, email, password and password_confirmation are required'
      );

      expect(registrar.register).not.toHaveBeenCalled();
    });
  });

  describe('when the password confirmation does not match', () => {
    beforeEach(() => {
      request.body.password_confirmation = 'something-else';
    });

    it('rejects with BadRequestError without registering', async () => {
      await expectAsync(
        new RegisterHandler(request, response, registrar).handle()
      ).toBeRejectedWithError(BadRequestError, 'password and password_confirmation do not match');

      expect(registrar.register).not.toHaveBeenCalled();
    });
  });

  describe('when the registrar rejects (e.g. duplicate username/email)', () => {
    beforeEach(() => {
      registrar.register.and.rejectWith(new BadRequestError('username is not available'));
    });

    it('propagates the BadRequestError', async () => {
      await expectAsync(
        new RegisterHandler(request, response, registrar).handle()
      ).toBeRejectedWithError(BadRequestError, 'username is not available');
    });
  });
});
