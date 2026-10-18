import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { setCookieHeaders } from './support/auth-requests.js';
import { buildAuthTestApp, BuildAuthTestAppResult } from './support/build-auth-test-app.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

// Cookie names and attributes set by a response, minus the per-session/time-dependent values.
function cookieShapes(response: request.Response): string[] {
  return setCookieHeaders(response).map((header) =>
    header.replace(/=[^;]*/, '=<value>').replace(/(Expires|Max-Age)=[^;]*/g, '$1'));
}

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('POST /auth/register.json error bodies', () => {
    it('answers an invalid payload with 400 VALIDATION_FAILED and the message list as details', async () => {
      const response = await registerUser(ctx.app, { username: '', email: 'not-an-email', password: 'short' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining(['email must be an email', 'password must be longer than or equal to 8 characters']),
      );
    });

    it('answers a taken username with 409 USERNAME_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'darthjee', email: 'other@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.USERNAME_TAKEN,
        message: 'username is not available',
      });
    });

    it('answers a taken email with 409 EMAIL_TAKEN', async () => {
      const response = await registerUser(ctx.app, { username: 'someone-else', email: 'darthjee@example.com' });

      expectErrorBody(response, {
        status: 409,
        code: ErrorCodes.EMAIL_TAKEN,
        message: 'email is not available',
      });
    });
  });
});

describe('AuthController registration status (e2e)', () => {
  let built: BuildAuthTestAppResult | undefined;

  afterEach(async () => {
    await built?.app.close();
    built = undefined;
  });

  async function appWithFlag(value?: string): Promise<INestApplication> {
    built = await buildAuthTestApp({
      registerDefaultUser: false,
      configOverrides: value === undefined ? {} : { KERGHAN_USER_APPROVAL_REQUIRED: value },
    });

    return built.app;
  }

  async function register(app: INestApplication): Promise<request.Response> {
    return registerUser(app, { username: 'newcomer', email: 'newcomer@example.com' }).expect(201);
  }

  it.each([
    ['unset', undefined, 'approved'],
    ['"true"', 'true', 'pending'],
    ['"false"', 'false', 'approved'],
    ['invalid ("yes")', 'yes', 'approved'],
  ])('with KERGHAN_USER_APPROVAL_REQUIRED %s (%p), creates the user %s', async (_label, value, status) => {
    await register(await appWithFlag(value));

    expect(built!.userRepo.rows[0].status).toBe(status);
  });

  it('answers with the same body and cookies whether the flag is on or off', async () => {
    const off = await register(await appWithFlag('false'));
    await built!.app.close();
    const on = await register(await appWithFlag('true'));

    expect(on.body).toEqual(off.body);
    expect(on.body.user).toEqual({ id: expect.any(Number), username: 'newcomer', email: 'newcomer@example.com', isAdmin: false });
    expect(cookieShapes(on)).toEqual(cookieShapes(off));
    expect(cookieShapes(on).length).toBeGreaterThan(0);
  });

  it('leaves existing users unchanged when the flag is on', async () => {
    const app = await appWithFlag('true');
    built!.userRepo.rows.push({ id: 99, username: 'old', email: 'old@example.com', status: 'approved' } as never);

    await register(app);

    expect(built!.userRepo.rows.find((row) => row.id === 99)!.status).toBe('approved');
  });
});
