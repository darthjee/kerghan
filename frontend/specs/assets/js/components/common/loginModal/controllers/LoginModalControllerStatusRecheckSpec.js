import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { flushMicrotasks as flush } from '../../../../../../support/flushMicrotasks.js';

describe('LoginModalController status re-check', () => {
  let setSubmitError;
  let client;

  const passwordFields = { username: 'foo', password: 'secret' };
  const registerFields = {
    username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
  };

  const build = () => new LoginModalController(
    jasmine.createSpy('setMode'),
    jasmine.createSpy('setFields'),
    jasmine.createSpy('setFieldErrors'),
    setSubmitError,
    jasmine.createSpy('setResultPanel'),
    jasmine.createSpy('setDeviceExpiresAt'),
    client,
  );

  const submissions = [
    {
      mode: 'password',
      fields: passwordFields,
      arrange: () => client.login.and.resolveTo({ user: { isAdmin: true } }),
    },
    {
      mode: 'register',
      fields: registerFields,
      arrange: () => client.register.and.resolveTo({ user: { isAdmin: true } }),
    },
  ];

  beforeEach(() => {
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', [
      'login', 'register', 'status', 'createAuthorizationRequest', 'pollAuthorizationRequest',
    ]);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
    installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  submissions.forEach(({ mode, fields, arrange }) => {
    describe(`after a successful ${mode} submit`, () => {
      beforeEach(arrange);

      it('re-checks status.json and emits the logged-in state from its answer', async () => {
        client.status.and.resolveTo({ loggedIn: true, isAdmin: false });

        await build().handleSubmit(mode, fields);

        expect(client.status).toHaveBeenCalledTimes(1);
        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(true, false, false);
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
        expect(globalThis.window.location.hash).toBe('/');
      });

      it('emits the pending state when status.json answers pending', async () => {
        client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });

        await build().handleSubmit(mode, fields);

        expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
        expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
        expect(globalThis.window.location.hash).toBe('/');
      });

      it('surfaces a failed re-check as a submit error, keeping the modal open', async () => {
        client.status.and.rejectWith(new Error('network down'));

        await build().handleSubmit(mode, fields);

        expect(setSubmitError).toHaveBeenCalledWith('network down');
        expect(AuthEvents.emit).not.toHaveBeenCalled();
        expect(LoginModalEvents.close).not.toHaveBeenCalled();
      });
    });
  });

  describe('after the device approves', () => {
    const request = { uuid: 'req-uuid', pollToken: 'poll-token', expiresAt: '2999-01-01T00:00:00.000Z' };

    beforeEach(() => {
      jasmine.clock().install();
      client.createAuthorizationRequest.and.resolveTo(request);
      client.pollAuthorizationRequest.and.resolveTo({ status: 'approved', user: { isAdmin: true } });
    });

    afterEach(() => {
      jasmine.clock().uninstall();
    });

    const approve = async () => {
      const controller = build();

      await controller.handleSubmit('device', { username: 'foo' });
      jasmine.clock().tick(5000);
      await flush();
      controller.stopPoller();
    };

    it('re-checks status.json and emits the pending state from its answer', async () => {
      client.status.and.resolveTo({ loggedIn: false, isAdmin: false, status: 'pending' });

      await approve();

      expect(client.status).toHaveBeenCalledTimes(1);
      expect(AuthEvents.emit).toHaveBeenCalledOnceWith(false, false, true);
      expect(LoginModalEvents.close).toHaveBeenCalledTimes(1);
    });

    it('surfaces a failed re-check as a submit error', async () => {
      client.status.and.rejectWith(new Error('network down'));

      await approve();

      expect(setSubmitError).toHaveBeenCalledWith('network down');
      expect(LoginModalEvents.close).not.toHaveBeenCalled();
    });
  });
});
