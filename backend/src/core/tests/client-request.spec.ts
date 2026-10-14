import type { Request } from 'express';
import { DEFAULT_TRUSTED_PROXY_HOPS, extractClientRequestInfo, parseTrustedProxyHops } from '../client-request.js';

/**
 * Builds a minimal fake Express `Request`, only populating the pieces
 * `extractClientRequestInfo` reads.
 * @param {object} options - The fields to populate.
 * @param {string | string[]} [options.forwardedFor] - The `x-forwarded-for` header value.
 * @param {string} [options.remoteAddress] - The raw socket peer address.
 * @param {string} [options.userAgent] - The `user-agent` header value.
 * @returns {Request} The fake request.
 */
function fakeRequest(options: {
  forwardedFor?: string | string[];
  remoteAddress?: string;
  userAgent?: string;
}): Request {
  return {
    headers: {
      'x-forwarded-for': options.forwardedFor,
      'user-agent': options.userAgent,
    },
    socket: { remoteAddress: options.remoteAddress },
  } as unknown as Request;
}

describe('extractClientRequestInfo', () => {
  it('falls back to the raw socket address when x-forwarded-for is absent', () => {
    const req = fakeRequest({ remoteAddress: '198.51.100.1' });

    expect(extractClientRequestInfo(req).ip).toBe('198.51.100.1');
  });

  it("returns '' when neither x-forwarded-for nor the socket address is present", () => {
    const req = fakeRequest({});

    expect(extractClientRequestInfo(req).ip).toBe('');
  });

  it('falls back to the socket address when x-forwarded-for is present but empty after trimming', () => {
    const req = fakeRequest({ forwardedFor: '   ', remoteAddress: '198.51.100.1' });

    expect(extractClientRequestInfo(req).ip).toBe('198.51.100.1');
  });

  it('defaults userAgent to \'\' when the header is absent', () => {
    const req = fakeRequest({ remoteAddress: '198.51.100.1' });

    expect(extractClientRequestInfo(req).userAgent).toBe('');
  });

  it('reads the user-agent header when present', () => {
    const req = fakeRequest({ remoteAddress: '198.51.100.1', userAgent: 'curl/8.0' });

    expect(extractClientRequestInfo(req).userAgent).toBe('curl/8.0');
  });

  it('exports 1 as the default trusted-hop count, matching the single-Tent-hop deployment', () => {
    expect(DEFAULT_TRUSTED_PROXY_HOPS).toBe(1);
  });

  describe('with the default trusted-hop count (1)', () => {
    it('trusts a single x-forwarded-for entry as-is (unchanged from pre-hardening behavior)', () => {
      const req = fakeRequest({ forwardedFor: '203.0.113.1', remoteAddress: '10.0.0.1' });

      expect(extractClientRequestInfo(req).ip).toBe('203.0.113.1');
    });

    it('trusts only the rightmost hop when more than one is present, ignoring attacker-supplied leftmost values', () => {
      // A client bypassing the trusted proxy could freely set this header to
      // "1.2.3.4, 5.6.7.8" — only the rightmost entry (as observed by the one
      // trusted hop) is used, never the client-supplied leftmost one.
      const req = fakeRequest({ forwardedFor: '1.2.3.4, 5.6.7.8', remoteAddress: '10.0.0.1' });

      expect(extractClientRequestInfo(req).ip).toBe('5.6.7.8');
    });

    it('trims whitespace around each hop', () => {
      const req = fakeRequest({ forwardedFor: ' 1.2.3.4 ,  5.6.7.8  ' });

      expect(extractClientRequestInfo(req).ip).toBe('5.6.7.8');
    });
  });

  describe('with a configured trusted-hop count greater than 1', () => {
    it('trusts the hop that many positions from the right', () => {
      const req = fakeRequest({ forwardedFor: '1.2.3.4, 5.6.7.8, 9.9.9.9' });

      expect(extractClientRequestInfo(req, 2).ip).toBe('5.6.7.8');
    });

    it('clamps to the leftmost available hop when fewer hops are present than trusted', () => {
      const req = fakeRequest({ forwardedFor: '1.2.3.4' });

      expect(extractClientRequestInfo(req, 3).ip).toBe('1.2.3.4');
    });
  });

  describe('when x-forwarded-for is sent as multiple headers (array)', () => {
    it('only considers the first header value', () => {
      const req = fakeRequest({ forwardedFor: ['1.2.3.4, 5.6.7.8', '9.9.9.9'] });

      expect(extractClientRequestInfo(req).ip).toBe('5.6.7.8');
    });
  });

  describe('with an invalid trusted-hop count', () => {
    it.each([
      ['NaN', Number.NaN],
      ['negative', -1],
      ['fractional', 1.5],
      ['Infinity', Number.POSITIVE_INFINITY],
    ])('treats a %s count as the default, never picking the leftmost entry', (_label, hops) => {
      const req = fakeRequest({ forwardedFor: '1.2.3.4, 5.6.7.8' });

      expect(extractClientRequestInfo(req, hops).ip).toBe('5.6.7.8');
    });
  });

  describe('with a trusted-hop count of 0', () => {
    it('selects no hop when x-forwarded-for is present (documented legacy behavior)', () => {
      const req = fakeRequest({ forwardedFor: '1.2.3.4, 5.6.7.8', remoteAddress: '10.0.0.1' });

      expect(extractClientRequestInfo(req, 0).ip).toBeUndefined();
    });

    it('still falls back to the socket address when x-forwarded-for is absent', () => {
      const req = fakeRequest({ remoteAddress: '10.0.0.1' });

      expect(extractClientRequestInfo(req, 0).ip).toBe('10.0.0.1');
    });
  });
});

describe('parseTrustedProxyHops', () => {
  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    [' 3 ', 3],
  ])('accepts the non-negative integer string %p', (raw, expected) => {
    expect(parseTrustedProxyHops(raw)).toBe(expected);
  });

  it.each([
    ['unset', undefined],
    ['null', null],
    ['empty', ''],
    ['blank', '   '],
    ['non-numeric', 'abc'],
    ['NaN', 'NaN'],
    ['negative', '-1'],
    ['fractional', '1.5'],
    ['exponent', '1e1'],
    ['hex', '0x2'],
    ['unsafe integer', '99999999999999999999'],
  ])('falls back to the default for a(n) %s value', (_label, raw) => {
    expect(parseTrustedProxyHops(raw)).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
  });

  it('accepts a valid number as-is', () => {
    expect(parseTrustedProxyHops(2)).toBe(2);
  });

  it.each([Number.NaN, -1, 1.5])('falls back to the default for the invalid number %p', (raw) => {
    expect(parseTrustedProxyHops(raw)).toBe(DEFAULT_TRUSTED_PROXY_HOPS);
  });
});
