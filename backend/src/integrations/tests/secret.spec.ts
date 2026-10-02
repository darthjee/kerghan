import { inspect } from 'node:util';
import { REDACTED, Secret } from '../secret.js';

const CANARY = 'ghp_CANARYcanary0000000000000000000000';

describe('Secret', () => {
  const secret = new Secret(CANARY);

  it('reveals the wrapped value', () => {
    expect(secret.reveal()).toBe(CANARY);
  });

  it('redacts toString', () => {
    expect(secret.toString()).toBe(REDACTED);
    expect(String(secret)).toBe(REDACTED);
  });

  it('redacts template literals', () => {
    expect(`${secret}`).toBe(REDACTED);
  });

  it('redacts toJSON and JSON.stringify', () => {
    expect(secret.toJSON()).toBe(REDACTED);
    expect(JSON.stringify({ credential: secret })).toBe(`{"credential":"${REDACTED}"}`);
  });

  it('redacts util.inspect, also when nested', () => {
    expect(inspect(secret)).toBe(REDACTED);
    expect(inspect({ nested: { secret } }, { depth: 5 })).not.toContain(CANARY);
  });

  it('redacts an object payload too', () => {
    const payload = new Secret({ token: CANARY });

    expect(JSON.stringify(payload)).not.toContain(CANARY);
    expect(inspect(payload)).not.toContain(CANARY);
    expect(payload.reveal()).toEqual({ token: CANARY });
  });

  it('is immutable', () => {
    expect(Object.isFrozen(secret)).toBe(true);
  });
});
