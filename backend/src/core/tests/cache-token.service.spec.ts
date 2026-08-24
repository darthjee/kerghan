import { createHmac } from 'node:crypto';
import { CacheTokenService } from '../cache-token.service.js';

describe('CacheTokenService', () => {
  const configService = { get: jest.fn().mockReturnValue('test-secret') };
  const service = new CacheTokenService(configService as never);

  it('derives a hex-encoded HMAC-SHA256 digest of the user id', () => {
    const expected = createHmac('sha256', 'test-secret').update('42').digest('hex');

    expect(service.generate(42)).toBe(expected);
  });

  it('derives a stable digest for the same user id', () => {
    expect(service.generate('42')).toBe(service.generate(42));
  });

  it('derives different digests for different user ids', () => {
    expect(service.generate(1)).not.toBe(service.generate(2));
  });
});
