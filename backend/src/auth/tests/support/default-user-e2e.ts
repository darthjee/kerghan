import { INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { buildAuthTestApp, BuildAuthTestAppOptions, BuildAuthTestAppResult } from './build-auth-test-app.js';
import { expectErrorBody } from './error-body.js';
import { ErrorCodes } from '../../../core/error-codes.js';
import { DefaultUserSettings } from '../../default-user.config.js';
import { DEFAULT_USER_MANAGED_MESSAGE } from '../../default-user.service.js';
import { User } from '../../entities/user.entity.js';

export const DEFAULT_PASSWORD = 'Sup3r-Secret-Pa$$';

export const ENABLED_DEFAULT_USER: Partial<DefaultUserSettings> = {
  enabled: true,
  username: 'admin',
  email: 'admin@kerghan.local',
  password: DEFAULT_PASSWORD,
  admin: true,
};

type UserRepo = BuildAuthTestAppResult['userRepo'];

// Registers the `beforeEach`/`afterEach` scaffold for the default-user e2e
// specs: a fresh app per test built with `options` (no `darthjee` seed unless
// asked), closed afterwards. Getter-based, like `useTestApp`.
export function useDefaultUserApp(options: BuildAuthTestAppOptions): BuildAuthTestAppResult {
  let current: BuildAuthTestAppResult;

  beforeEach(async () => {
    current = await buildAuthTestApp({ registerDefaultUser: false, adminGuard: true, ...options });
  });

  afterEach(async () => {
    await current.app.close();
  });

  return new Proxy({} as BuildAuthTestAppResult, {
    get: (_target, key: keyof BuildAuthTestAppResult) => current[key],
  });
}

// Seeds a user row directly, standing in for a row created by an earlier
// boot (or by registration), with `password` hashed.
export async function seedUser(
  userRepo: UserRepo,
  attrs: Partial<User> & { password?: string },
): Promise<User> {
  const { password = DEFAULT_PASSWORD, ...rest } = attrs;

  return userRepo.save(userRepo.create({
    isAdmin: false,
    passwordDigest: await bcrypt.hash(password, 4),
    ...rest,
  }));
}

// Makes the in-memory repo look users up by username the way MySQL's default
// (case- and accent-insensitive) collation does, so a stored `ÁDMIN` matches a
// configured `admin`.
export function useInsensitiveUsernameCollation(userRepo: UserRepo): void {
  const fold = (value: string): string => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const exact = userRepo.findOneBy;

  userRepo.findOneBy = async (where: Partial<User>): Promise<User | null> => {
    if (where.username === undefined) {
      return exact(where);
    }

    return userRepo.rows.find((row) => fold(row.username) === fold(where.username as string)) ?? null;
  };
}

// Logs in and returns the `access_token` cookie pair.
export async function accessCookieFor(app: INestApplication, username: string, password = DEFAULT_PASSWORD): Promise<string> {
  const response = await request(app.getHttpServer()).post('/auth/login.json').send({ username, password });
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? [])
    .find((cookie) => cookie.startsWith('access_token='));

  if (!header) {
    throw new Error('access_token cookie not set');
  }

  return header.split(';')[0];
}

// Asserts the documented `409 DEFAULT_USER_MANAGED` body (no `error.details`).
export function expectDefaultUserManagedBody(response: request.Response): void {
  expectErrorBody(response, {
    status: 409,
    code: ErrorCodes.DEFAULT_USER_MANAGED,
    message: DEFAULT_USER_MANAGED_MESSAGE,
  });
}
