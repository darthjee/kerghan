import { expectNoCanary } from './support/canary-assertions.js';

describe('expectNoCanary', () => {
  it('passes when no haystack holds a canary', () => {
    expect(() => expectNoCanary(['clean', '{"a":1}'], ['CANARY'])).not.toThrow();
  });

  it('fails naming the haystack and a short excerpt when a canary is found', () => {
    expect(() => expectNoCanary(['clean', 'before CANARYsecret after'], ['CANARYsecret'])).toThrow(/haystack #1 holds .*CANARYsecret.*\.\.\.before CANARYsecret after\.\.\./s);
  });

  it('checks every canary against every haystack', () => {
    expect(() => expectNoCanary(['one', 'two TOKEN'], ['ONE', 'TOKEN'])).toThrow(/haystack #1 holds .*TOKEN/s);
  });
});
