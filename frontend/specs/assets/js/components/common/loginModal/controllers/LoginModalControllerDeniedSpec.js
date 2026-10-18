import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import { USER_DENIED_MESSAGE } from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';

describe('LoginModalController denied login', () => {
  let setSubmitError;
  let client;

  const build = () => new LoginModalController(
    jasmine.createSpy('setMode'),
    jasmine.createSpy('setFields'),
    jasmine.createSpy('setFieldErrors'),
    setSubmitError,
    jasmine.createSpy('setResultPanel'),
    jasmine.createSpy('setDeviceExpiresAt'),
    client,
  );

  beforeEach(() => {
    setSubmitError = jasmine.createSpy('setSubmitError');
    client = jasmine.createSpyObj('client', ['login', 'status']);
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'close');
  });

  it('shows the denied message on a 403 USER_DENIED, without re-checking or closing', async () => {
    client.login.and.rejectWith(new ApiError(403, 'This account has been denied access', 'USER_DENIED'));

    await build().handleSubmit('password', { username: 'foo', password: 'secret' });

    expect(setSubmitError).toHaveBeenCalledWith(USER_DENIED_MESSAGE);
    expect(client.status).not.toHaveBeenCalled();
    expect(AuthEvents.emit).not.toHaveBeenCalled();
    expect(LoginModalEvents.close).not.toHaveBeenCalled();
  });

  it('keeps the usual credentials error on a 401', async () => {
    client.login.and.rejectWith(new ApiError(401, 'Invalid credentials', 'INVALID_CREDENTIALS'));

    await build().handleSubmit('password', { username: 'foo', password: 'wrong' });

    expect(setSubmitError).toHaveBeenCalledWith('Invalid credentials');
    expect(setSubmitError).not.toHaveBeenCalledWith(USER_DENIED_MESSAGE);
  });
});
