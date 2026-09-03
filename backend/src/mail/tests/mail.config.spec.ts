import { buildMailConfig } from '../mail.config.js';

function fakeConfigService(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as never;
}

describe('buildMailConfig', () => {
  describe('when email is disabled', () => {
    it.each([
      ['unset', undefined],
      ['"false"', 'false'],
      ['"anything"', 'anything'],
    ])('returns a frozen disabled config when KERGHAN_EMAILS_ENABLED is %s', (_label, value) => {
      const config = buildMailConfig(fakeConfigService({ KERGHAN_EMAILS_ENABLED: value }));

      expect(config).toEqual({ enabled: false, from: '', transport: null });
      expect(Object.isFrozen(config)).toBe(true);
    });
  });

  describe('when email is enabled', () => {
    const base = {
      KERGHAN_EMAILS_ENABLED: 'true',
      KERGHAN_EMAIL_HOST: 'smtp.example.com',
      KERGHAN_EMAIL_FROM: 'no-reply@kerghan.local',
    };

    it('resolves an enabled config echoing from and building a transport', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.enabled).toBe(true);
      expect(config.from).toBe('no-reply@kerghan.local');
      expect(config.transport).not.toBeNull();
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('throws naming KERGHAN_EMAIL_HOST when the host is missing', () => {
      const config = fakeConfigService({ ...base, KERGHAN_EMAIL_HOST: undefined });

      expect(() => buildMailConfig(config)).toThrow('KERGHAN_EMAIL_HOST');
    });

    it('throws naming KERGHAN_EMAIL_FROM when the from address is missing', () => {
      const config = fakeConfigService({ ...base, KERGHAN_EMAIL_FROM: undefined });

      expect(() => buildMailConfig(config)).toThrow('KERGHAN_EMAIL_FROM');
    });

    it('defaults the port to 587 when unset', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.transport?.port).toBe(587);
    });

    it('marks the transport secure with no STARTTLS upgrade on port 465', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, KERGHAN_EMAIL_PORT: '465' }));

      expect(config.transport?.secure).toBe(true);
      expect(config.transport?.requireTLS).toBeFalsy();
    });

    it('requires a STARTTLS upgrade on port 587 when USE_TLS is unset', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, KERGHAN_EMAIL_PORT: '587' }));

      expect(config.transport?.secure).toBe(false);
      expect(config.transport?.requireTLS).toBe(true);
    });

    it('does not require STARTTLS when USE_TLS is "false"', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, KERGHAN_EMAIL_USE_TLS: 'false' }));

      expect(config.transport?.requireTLS).toBe(false);
    });

    it('includes auth only when both user and password are set', () => {
      const config = buildMailConfig(fakeConfigService({
        ...base,
        KERGHAN_EMAIL_USER: 'mailer',
        KERGHAN_EMAIL_PASSWORD: 's3cret',
      }));

      expect(config.transport?.auth).toEqual({ user: 'mailer', pass: 's3cret' });
    });

    it('omits auth when only the user is set', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, KERGHAN_EMAIL_USER: 'mailer' }));

      expect(config.transport?.auth).toBeUndefined();
    });

    it('defaults the three timeout fields to 10000 when TIMEOUT_MS is unset', () => {
      const config = buildMailConfig(fakeConfigService(base));

      expect(config.transport?.connectionTimeout).toBe(10000);
      expect(config.transport?.greetingTimeout).toBe(10000);
      expect(config.transport?.socketTimeout).toBe(10000);
    });

    it('echoes TIMEOUT_MS into the three timeout fields when set', () => {
      const config = buildMailConfig(fakeConfigService({ ...base, KERGHAN_EMAIL_TIMEOUT_MS: '2500' }));

      expect(config.transport?.connectionTimeout).toBe(2500);
      expect(config.transport?.greetingTimeout).toBe(2500);
      expect(config.transport?.socketTimeout).toBe(2500);
    });

    it('trims surrounding whitespace on host, from and user', () => {
      const config = buildMailConfig(fakeConfigService({
        KERGHAN_EMAILS_ENABLED: 'true',
        KERGHAN_EMAIL_HOST: '  smtp.example.com  ',
        KERGHAN_EMAIL_FROM: '  no-reply@kerghan.local  ',
        KERGHAN_EMAIL_USER: '  mailer  ',
        KERGHAN_EMAIL_PASSWORD: 's3cret',
      }));

      expect(config.transport?.host).toBe('smtp.example.com');
      expect(config.from).toBe('no-reply@kerghan.local');
      expect(config.transport?.auth).toEqual({ user: 'mailer', pass: 's3cret' });
    });
  });
});
