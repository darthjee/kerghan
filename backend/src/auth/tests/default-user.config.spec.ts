import { DefaultUserConfig } from '../default-user.config.js';
import { PASSWORD_MIN_LENGTH } from '../password-rules.js';

type Values = Record<string, string | undefined>;

const SECRET = 'Sup3r-Secret-Pa$$';

const VALID: Values = {
  KERGHAN_DEFAULT_USER_ENABLED: 'true',
  KERGHAN_DEFAULT_USER_USERNAME: 'admin',
  KERGHAN_DEFAULT_USER_EMAIL: 'admin@kerghan.local',
  KERGHAN_DEFAULT_USER_PASSWORD: SECRET,
};

function fakeConfigService(values: Values) {
  return { get: jest.fn((key: string) => values[key]) } as never;
}

function build(values: Values): DefaultUserConfig {
  return DefaultUserConfig.fromConfigService(fakeConfigService(values));
}

function errorOf(values: Values): Error {
  try {
    build(values);
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected DefaultUserConfig to throw');
}

function allowlist(allowedIps: string | undefined): DefaultUserConfig {
  return build({ ...VALID, KERGHAN_DEFAULT_USER_ALLOWED_IPS: allowedIps });
}

describe('DefaultUserConfig', () => {
  describe('isEnabled', () => {
    it.each([
      [undefined, undefined, false],
      ['true', undefined, true],
      [undefined, 'true', true],
      ['true', 'true', true],
    ])('ENABLED=%s ALWAYS_AUTHENTICATED=%s -> %s', (enabled, always, expected) => {
      const config = build({
        ...VALID,
        KERGHAN_DEFAULT_USER_ENABLED: enabled,
        KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED: always,
      });

      expect(config.isEnabled()).toBe(expected);
      expect(config.isAlwaysAuthenticated()).toBe(always === 'true');
    });

    it.each(['TRUE', '1', 'yes', '', ' true', 'true ', undefined])(
      'treats flag value %p as off',
      (value) => {
        const config = build({
          ...VALID,
          KERGHAN_DEFAULT_USER_ENABLED: value,
          KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED: value,
          KERGHAN_DEFAULT_USER_ADMIN: value,
        });

        expect(config.isEnabled()).toBe(false);
        expect(config.isAlwaysAuthenticated()).toBe(false);
        expect(config.isAdmin()).toBe(false);
      },
    );
  });

  describe('values', () => {
    it('exposes the configured values', () => {
      const config = build({ ...VALID, KERGHAN_DEFAULT_USER_ADMIN: 'true' });

      expect(config.username()).toBe('admin');
      expect(config.email()).toBe('admin@kerghan.local');
      expect(config.password()).toBe(SECRET);
      expect(config.isAdmin()).toBe(true);
    });

    it('defaults isAdmin to false when ADMIN is unset', () => {
      expect(build(VALID).isAdmin()).toBe(false);
    });

    it('trims username and email but keeps the password verbatim', () => {
      const config = build({
        ...VALID,
        KERGHAN_DEFAULT_USER_USERNAME: '  admin \t',
        KERGHAN_DEFAULT_USER_EMAIL: ' admin@kerghan.local ',
        KERGHAN_DEFAULT_USER_PASSWORD: `  ${SECRET} `,
      });

      expect(config.username()).toBe('admin');
      expect(config.email()).toBe('admin@kerghan.local');
      expect(config.password()).toBe(`  ${SECRET} `);
    });
  });

  describe('validation when enabled', () => {
    it.each([
      'KERGHAN_DEFAULT_USER_USERNAME',
      'KERGHAN_DEFAULT_USER_EMAIL',
      'KERGHAN_DEFAULT_USER_PASSWORD',
    ])('throws naming %s when it is missing', (name) => {
      expect(() => build({ ...VALID, [name]: undefined })).toThrow(name);
    });

    it.each([
      'KERGHAN_DEFAULT_USER_USERNAME',
      'KERGHAN_DEFAULT_USER_EMAIL',
    ])('throws naming %s when it is only whitespace', (name) => {
      expect(() => build({ ...VALID, [name]: '   ' })).toThrow(name);
    });

    it('throws naming KERGHAN_DEFAULT_USER_PASSWORD when it is empty', () => {
      expect(() => build({ ...VALID, KERGHAN_DEFAULT_USER_PASSWORD: '' }))
        .toThrow('KERGHAN_DEFAULT_USER_PASSWORD');
    });

    it('validates when only ALWAYS_AUTHENTICATED is on', () => {
      expect(() => build({ KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED: 'true' }))
        .toThrow('KERGHAN_DEFAULT_USER_USERNAME');
    });

    it('names every problem in a single error', () => {
      const error = errorOf({
        KERGHAN_DEFAULT_USER_ENABLED: 'true',
        KERGHAN_DEFAULT_USER_EMAIL: 'not-an-email',
        KERGHAN_DEFAULT_USER_ALLOWED_IPS: 'abc',
      });

      expect(error.message).toMatch(/^default-user: /);
      expect(error.message).toContain('KERGHAN_DEFAULT_USER_USERNAME');
      expect(error.message).toContain('KERGHAN_DEFAULT_USER_EMAIL (not a valid email)');
      expect(error.message).toContain('KERGHAN_DEFAULT_USER_PASSWORD');
      expect(error.message).toContain('"abc"');
    });

    it('throws on an invalid email', () => {
      expect(() => build({ ...VALID, KERGHAN_DEFAULT_USER_EMAIL: 'not-an-email' }))
        .toThrow('KERGHAN_DEFAULT_USER_EMAIL (not a valid email)');
    });

    it('throws on a password shorter than PASSWORD_MIN_LENGTH', () => {
      const short = 'x'.repeat(PASSWORD_MIN_LENGTH - 1);

      expect(() => build({ ...VALID, KERGHAN_DEFAULT_USER_PASSWORD: short }))
        .toThrow(`KERGHAN_DEFAULT_USER_PASSWORD (shorter than ${PASSWORD_MIN_LENGTH} characters)`);
    });

    it('accepts a password of exactly PASSWORD_MIN_LENGTH', () => {
      const exact = 'x'.repeat(PASSWORD_MIN_LENGTH);

      expect(build({ ...VALID, KERGHAN_DEFAULT_USER_PASSWORD: exact }).password()).toBe(exact);
    });

    it.each(['300.1.1.1', '10.0.0.0/33', '::1/129', 'abc', '10.0.0.0/x', '10.0.0.0/8/8', '10.0.0.0/'])(
      'throws naming the malformed ALLOWED_IPS entry %p',
      (entry) => {
        expect(() => allowlist(`127.0.0.1, ${entry}`))
          .toThrow(`KERGHAN_DEFAULT_USER_ALLOWED_IPS (malformed entry "${entry}")`);
      },
    );

    it.each([
      ['a short password', { KERGHAN_DEFAULT_USER_PASSWORD: 'Zq9!x' }, 'Zq9!x'],
      ['an invalid email', { KERGHAN_DEFAULT_USER_EMAIL: 'bad' }, SECRET],
      ['a malformed allowlist', { KERGHAN_DEFAULT_USER_ALLOWED_IPS: 'nope' }, SECRET],
      ['the production guard', { STAGE: 'production', KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED: 'true' }, SECRET],
    ])('never includes the password in the error for %s', (_label, overrides, password) => {
      const error = errorOf({ ...VALID, ...overrides });

      expect(error.message).not.toContain(password);
    });
  });

  describe('when disabled', () => {
    it('requires nothing', () => {
      expect(() => build({})).not.toThrow();
    });

    it('does not validate values or ALLOWED_IPS', () => {
      const config = build({
        KERGHAN_DEFAULT_USER_EMAIL: 'not-an-email',
        KERGHAN_DEFAULT_USER_PASSWORD: 'short',
        KERGHAN_DEFAULT_USER_ALLOWED_IPS: 'abc,300.1.1.1',
      });

      expect(config.isEnabled()).toBe(false);
      expect(config.isIpAllowed('127.0.0.1')).toBe(true);
    });
  });

  describe('production guard', () => {
    const production = { ...VALID, STAGE: 'production', KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED: 'true' };

    it('throws naming ALLOW_IN_PRODUCTION when always-authenticated in production without it', () => {
      expect(() => build(production)).toThrow('KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION');
    });

    it('boots with ALLOW_IN_PRODUCTION=true', () => {
      const config = build({ ...production, KERGHAN_DEFAULT_USER_ALLOW_IN_PRODUCTION: 'true' });

      expect(config.isAlwaysAuthenticated()).toBe(true);
    });

    it('boots with ENABLED only in production without it', () => {
      expect(() => build({ ...VALID, STAGE: 'production' })).not.toThrow();
    });

    it('does not apply outside production', () => {
      expect(() => build({ ...production, STAGE: 'development' })).not.toThrow();
    });
  });

  describe('isIpAllowed', () => {
    describe.each([
      ['unset', undefined],
      ['empty', ''],
      ['only commas and spaces', ' , ,'],
    ])('with ALLOWED_IPS %s', (_label, value) => {
      const config = allowlist(value);

      it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '::FFFF:127.0.0.1', ' 127.0.0.1 '])(
        'allows loopback %p',
        (ip) => {
          expect(config.isIpAllowed(ip)).toBe(true);
        },
      );

      it.each(['10.0.0.1', '127.0.0.2', '2001:db8::1'])('rejects %p', (ip) => {
        expect(config.isIpAllowed(ip)).toBe(false);
      });
    });

    describe('with single IPs and CIDRs', () => {
      const config = allowlist(' 203.0.113.7 ,,10.0.0.0/8, 2001:db8::/32 , fe80::1 ,');

      it.each([
        '203.0.113.7',
        '10.1.2.3',
        '10.255.255.255',
        '::ffff:10.1.2.3',
        '::ffff:203.0.113.7',
        '2001:db8::1',
        '2001:db8:ffff::1',
        'fe80::1',
      ])('allows %p', (ip) => {
        expect(config.isIpAllowed(ip)).toBe(true);
      });

      it.each([
        '203.0.113.8',
        '11.0.0.1',
        '127.0.0.1',
        '::1',
        '2001:db9::1',
        'fe80::2',
        '::ffff:11.0.0.1',
      ])('rejects %p', (ip) => {
        expect(config.isIpAllowed(ip)).toBe(false);
      });
    });

    it.each(['', 'abc', '300.1.1.1', '10.0.0.0/8', '::ffff:300.1.1.1'])(
      'returns false for the non-IP input %p',
      (ip) => {
        expect(allowlist('0.0.0.0/0').isIpAllowed(ip)).toBe(false);
      },
    );
  });
});
