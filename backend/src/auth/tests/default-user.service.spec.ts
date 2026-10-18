import { ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { ErrorCodes } from '../../core/error-codes.js';
import { DefaultUserConfig, DefaultUserSettings } from '../default-user.config.js';
import {
  AUTOMATIC_LOGIN_WARNING,
  DEFAULT_USER_MANAGED_MESSAGE,
  DefaultUserService,
} from '../default-user.service.js';
import { RevokedReason } from '../entities/refresh-token.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';
import { createInMemoryRepo } from './support/in-memory-repo.js';

const PASSWORD = 'Sup3r-Secret-Pa$$';

const ENABLED_SETTINGS: DefaultUserSettings = {
  enabled: true,
  alwaysAuthenticated: false,
  username: 'admin',
  email: 'admin@kerghan.local',
  password: PASSWORD,
  admin: true,
  allowedIps: [],
  allowInProduction: false,
  stage: 'development',
};

function duplicateEntryError(): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }));
}

describe('DefaultUserService', () => {
  let userRepo: ReturnType<typeof createInMemoryRepo<User>>;
  let tokenService: { revokeUserTokens: jest.Mock; issueTokens: jest.Mock };
  let logger: { info: jest.Mock; warn: jest.Mock };

  const buildService = (overrides: Partial<DefaultUserSettings> = {}): DefaultUserService =>
    new DefaultUserService(
      userRepo as never,
      new DefaultUserConfig({ ...ENABLED_SETTINGS, ...overrides }),
      tokenService as unknown as TokenService,
      logger as never,
    );

  const seedUser = async (attrs: Partial<User>): Promise<User> =>
    userRepo.save(userRepo.create({ isAdmin: false, status: 'approved', ...attrs }));

  beforeEach(() => {
    userRepo = createInMemoryRepo<User>();
    tokenService = {
      revokeUserTokens: jest.fn().mockResolvedValue(undefined),
      issueTokens: jest.fn(async (user: User) => ({
        user,
        accessToken: 'access',
        refreshToken: 'refresh',
        refreshTokenExpiresAt: new Date(),
      })),
    };
    logger = { info: jest.fn(), warn: jest.fn() };
  });

  describe('onApplicationBootstrap', () => {
    describe('when the user does not exist', () => {
      it('creates it with the configured username, email, password and admin flag', async () => {
        await buildService().onApplicationBootstrap();

        expect(userRepo.rows).toHaveLength(1);
        const [user] = userRepo.rows;
        expect(user).toMatchObject({ username: 'admin', email: 'admin@kerghan.local', isAdmin: true });
        await expect(bcrypt.compare(PASSWORD, user.passwordDigest)).resolves.toBe(true);
      });

      it('creates it approved', async () => {
        await buildService().onApplicationBootstrap();

        expect(userRepo.rows[0].status).toBe('approved');
      });

      it('records the created row id', async () => {
        await seedUser({ username: 'other', email: 'other@example.com', passwordDigest: 'x' });
        const service = buildService();

        await service.onApplicationBootstrap();

        const created = userRepo.rows.find((row) => row.username === 'admin') as User;
        expect(service.isDefaultUser(created.id)).toBe(true);
        expect(service.isDefaultUser(1)).toBe(false);
      });

      it('does not revoke any session', async () => {
        await buildService().onApplicationBootstrap();

        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });
    });

    describe('when the user exists', () => {
      let existing: User;

      beforeEach(async () => {
        await seedUser({ username: 'someone', email: 'someone@example.com', passwordDigest: 'x' });
        existing = await seedUser({
          username: 'admin',
          email: 'old@example.com',
          passwordDigest: await bcrypt.hash(PASSWORD, 4),
          isAdmin: false,
        });
      });

      it('overwrites email and admin flag', async () => {
        await buildService().onApplicationBootstrap();

        expect(existing).toMatchObject({ email: 'admin@kerghan.local', isAdmin: true });
        expect(userRepo.rows).toHaveLength(2);
      });

      it.each(['pending', 'denied'] as const)('forces a %s default user back to approved, revoking nothing', async (status) => {
        existing.status = status;

        await buildService().onApplicationBootstrap();

        expect(existing.status).toBe('approved');
        expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
      });

      it('overwrites the admin flag to false when not configured as admin', async () => {
        existing.isAdmin = true;

        await buildService({ admin: false }).onApplicationBootstrap();

        expect(existing.isAdmin).toBe(false);
      });

      it('records the matched row id', async () => {
        const service = buildService();

        await service.onApplicationBootstrap();

        expect(service.isDefaultUser(existing.id)).toBe(true);
        expect(service.isDefaultUser(1)).toBe(false);
      });

      describe('with an unchanged password', () => {
        it('does not rehash the password nor revoke sessions', async () => {
          const digest = existing.passwordDigest;
          const hashSpy = jest.spyOn(bcrypt, 'hash');

          await buildService().onApplicationBootstrap();

          expect(existing.passwordDigest).toBe(digest);
          // `bcrypt.compare` itself calls `hash` with the stored salt; a rehash passes a cost (number).
          expect(hashSpy.mock.calls.filter(([, salt]) => typeof salt === 'number')).toEqual([]);
          expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
          hashSpy.mockRestore();
        });
      });

      describe('with a changed password', () => {
        beforeEach(async () => {
          existing.passwordDigest = await bcrypt.hash('an-old-password', 4);
        });

        it('rehashes the password', async () => {
          await buildService().onApplicationBootstrap();

          await expect(bcrypt.compare(PASSWORD, existing.passwordDigest)).resolves.toBe(true);
        });

        it('revokes the user sessions as an admin password change', async () => {
          await buildService().onApplicationBootstrap();

          expect(tokenService.revokeUserTokens)
            .toHaveBeenCalledWith(existing.id, RevokedReason.ADMIN_PASSWORD_CHANGE);
        });
      });
    });

    describe('when the configured email belongs to another user', () => {
      it('fails boot with a clear error when the user does not exist', async () => {
        await seedUser({ username: 'other', email: 'admin@kerghan.local', passwordDigest: 'x' });

        await expect(buildService().onApplicationBootstrap())
          .rejects.toThrow('default user email already belongs to another user');
        expect(userRepo.rows).toHaveLength(1);
      });

      it('fails boot when the user exists with a different email', async () => {
        await seedUser({ username: 'other', email: 'admin@kerghan.local', passwordDigest: 'x' });
        await seedUser({ username: 'admin', email: 'mine@example.com', passwordDigest: 'x' });

        await expect(buildService().onApplicationBootstrap())
          .rejects.toThrow('default user email already belongs to another user');
      });

      it('never includes the password in the error', async () => {
        await seedUser({ username: 'other', email: 'admin@kerghan.local', passwordDigest: 'x' });

        const error: Error = await buildService().onApplicationBootstrap().then(
          () => { throw new Error('expected boot to fail'); },
          (rejection: Error) => rejection,
        );

        expect(error.message).not.toContain(PASSWORD);
      });

      it('holds no id', async () => {
        const other = await seedUser({ username: 'other', email: 'admin@kerghan.local', passwordDigest: 'x' });
        const service = buildService();

        await service.onApplicationBootstrap().catch(() => undefined);

        expect(service.isDefaultUser(other.id)).toBe(false);
      });
    });

    describe('when the insert hits the unique constraint', () => {
      let raced: User;
      let save: jest.SpyInstance;

      beforeEach(() => {
        const originalSave = userRepo.save;

        save = jest.spyOn(userRepo, 'save').mockImplementationOnce(async () => {
          raced = await originalSave({
            username: 'admin',
            email: 'admin@kerghan.local',
            passwordDigest: 'other-instance-digest',
            isAdmin: true,
          } as User);
          throw duplicateEntryError();
        });
      });

      it('falls through to the update path and records the existing id', async () => {
        const service = buildService();

        await service.onApplicationBootstrap();

        expect(userRepo.rows).toHaveLength(1);
        expect(service.isDefaultUser(raced.id)).toBe(true);
        await expect(bcrypt.compare(PASSWORD, raced.passwordDigest)).resolves.toBe(true);
        expect(save).toHaveBeenCalledTimes(2);
      });

      it('rethrows when the user still cannot be found', async () => {
        save.mockReset().mockRejectedValueOnce(duplicateEntryError());

        await expect(buildService().onApplicationBootstrap()).rejects.toBeInstanceOf(QueryFailedError);
      });
    });

    it('rethrows a non-duplicate insert error', async () => {
      jest.spyOn(userRepo, 'save').mockRejectedValueOnce(new Error('connection lost'));

      await expect(buildService().onApplicationBootstrap()).rejects.toThrow('connection lost');
    });

    describe('when disabled', () => {
      it('does nothing and leaves an existing default user untouched', async () => {
        const existing = await seedUser({ username: 'admin', email: 'old@example.com', passwordDigest: 'x' });
        const findOneBy = jest.spyOn(userRepo, 'findOneBy');
        const save = jest.spyOn(userRepo, 'save');
        const service = buildService({ enabled: false });

        await service.onApplicationBootstrap();

        expect(findOneBy).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(existing).toMatchObject({ email: 'old@example.com', passwordDigest: 'x', isAdmin: false });
        expect(service.isDefaultUser(existing.id)).toBe(false);
      });
    });
  });

  describe('isDefaultUser', () => {
    it('is false before boot sync recorded an id', () => {
      expect(buildService().isDefaultUser(1)).toBe(false);
    });
  });

  describe('assertNotDefaultUser', () => {
    let service: DefaultUserService;
    let defaultId: number;

    beforeEach(async () => {
      service = buildService();
      await service.onApplicationBootstrap();
      defaultId = userRepo.rows[0].id;
    });

    it('throws 409 DEFAULT_USER_MANAGED for the default user', () => {
      expect.assertions(3);

      try {
        service.assertNotDefaultUser(defaultId);
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as ConflictException).getStatus()).toBe(409);
        expect((error as ConflictException).getResponse()).toEqual({
          code: ErrorCodes.DEFAULT_USER_MANAGED,
          message: DEFAULT_USER_MANAGED_MESSAGE,
        });
      }
    });

    it('does not throw for another user', () => {
      expect(() => service.assertNotDefaultUser(defaultId + 1)).not.toThrow();
    });
  });

  describe('boot warning', () => {
    const allLogLines = (): string => JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls]);

    it('is not logged when always-authenticated is off', async () => {
      await buildService().onApplicationBootstrap();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('names the username and the loopback default allowlist when none is configured', async () => {
      await buildService({ alwaysAuthenticated: true }).onApplicationBootstrap();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(AUTOMATIC_LOGIN_WARNING, {
        context: 'DefaultUserService',
        username: 'admin',
        allowedIps: ['127.0.0.1', '::1'],
      });
    });

    it('names the configured allowlist', async () => {
      await buildService({ alwaysAuthenticated: true, allowedIps: ['10.0.0.0/8', '203.0.113.7'] })
        .onApplicationBootstrap();

      expect(logger.warn.mock.calls[0][1]).toMatchObject({ allowedIps: ['10.0.0.0/8', '203.0.113.7'] });
    });

    it('never includes the password in any log line', async () => {
      await buildService({ alwaysAuthenticated: true }).onApplicationBootstrap();

      expect(allLogLines()).not.toContain(PASSWORD);
    });

    it('is logged after the sync on every boot', async () => {
      await buildService({ alwaysAuthenticated: true }).onApplicationBootstrap();
      await buildService({ alwaysAuthenticated: true }).onApplicationBootstrap();

      expect(logger.warn).toHaveBeenCalledTimes(2);
      expect(userRepo.rows).toHaveLength(1);
    });
  });

  describe('autoLogin', () => {
    const bootedService = async (overrides: Partial<DefaultUserSettings> = {}): Promise<DefaultUserService> => {
      const service = buildService({ alwaysAuthenticated: true, ...overrides });

      await service.onApplicationBootstrap();

      return service;
    };

    it('issues a regular (non-persistent) session for the default user from an allowed IP', async () => {
      const service = await bootedService();

      const result = await service.autoLogin('127.0.0.1');

      const [user] = userRepo.rows;
      expect(tokenService.issueTokens).toHaveBeenCalledTimes(1);
      expect(tokenService.issueTokens).toHaveBeenCalledWith(user, false);
      expect(result).toMatchObject({ user, accessToken: 'access', refreshToken: 'refresh' });
    });

    it('accepts an IPv4-mapped loopback address', async () => {
      const service = await bootedService();

      await expect(service.autoLogin('::ffff:127.0.0.1')).resolves.not.toBeNull();
    });

    it('accepts an IP inside a configured range', async () => {
      const service = await bootedService({ allowedIps: ['10.0.0.0/8'] });

      await expect(service.autoLogin('10.1.2.3')).resolves.not.toBeNull();
    });

    it.each(['10.0.0.1', '', 'not-an-ip'])('returns null for the disallowed IP %p', async (ip) => {
      const service = await bootedService();

      await expect(service.autoLogin(ip)).resolves.toBeNull();
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('returns null when always-authenticated is off', async () => {
      const service = buildService();
      await service.onApplicationBootstrap();

      await expect(service.autoLogin('127.0.0.1')).resolves.toBeNull();
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('returns null when boot sync recorded no id', async () => {
      const service = buildService({ alwaysAuthenticated: true });

      await expect(service.autoLogin('127.0.0.1')).resolves.toBeNull();
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('returns null when the default user row is gone', async () => {
      const service = await bootedService();
      userRepo.rows.splice(0, userRepo.rows.length);

      await expect(service.autoLogin('127.0.0.1')).resolves.toBeNull();
      expect(tokenService.issueTokens).not.toHaveBeenCalled();
    });

    it('never revokes anything', async () => {
      const service = await bootedService();

      await service.autoLogin('127.0.0.1');

      expect(tokenService.revokeUserTokens).not.toHaveBeenCalled();
    });
  });
});
