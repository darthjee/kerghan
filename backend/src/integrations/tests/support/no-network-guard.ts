/**
 * The no-network guard of the Integrations GitHub specs
 * (`docs/agents/specs/repos/testing.md#no-network-guard`): before each test,
 * `globalThis.fetch` is replaced with a mock that throws unless the spec
 * scripts it, so no test ever reaches the real GitHub. Other modules' specs
 * do not call it and stay untouched.
 */

/** Error thrown by an unscripted `fetch`. */
export class UnexpectedNetworkCall extends Error {
  constructor(url: unknown) {
    super(`no-network guard: unscripted fetch to ${String(url).split('?')[0]}`);
    this.name = 'UnexpectedNetworkCall';
  }
}

let current: jest.Mock | null = null;

/**
 * Installs the guard for every test of the calling `describe` block.
 * @returns {void}
 */
export function installNoNetworkGuard(): void {
  let original: typeof fetch;

  beforeEach(() => {
    original = globalThis.fetch;
    current = jest.fn(async (url: unknown) => {
      throw new UnexpectedNetworkCall(url);
    });
    globalThis.fetch = current as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = original;
    current = null;
  });
}

/**
 * The current test's `fetch` mock, for scripting (`mockResolvedValueOnce`,
 * `mockImplementationOnce`) and for asserting the calls.
 * @returns {jest.Mock} The mock.
 */
export function fetchMock(): jest.Mock {
  if (current === null) {
    throw new Error('installNoNetworkGuard() was not called in this describe block');
  }

  return current;
}

/** One recorded `fetch` call. */
export interface FetchCall {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
}

/**
 * The calls the current test's `fetch` received, with their headers as a plain object.
 * @returns {FetchCall[]} The calls, in order.
 */
export function fetchCalls(): FetchCall[] {
  return fetchMock().mock.calls.map(([url, init]: [string, RequestInit | undefined]) => ({
    url,
    init: init ?? {},
    headers: { ...(init?.headers as Record<string, string> | undefined ?? {}) },
  }));
}

/** A promise with its resolver exposed, to hold a `fetch` reply. */
export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Builds a deferred promise.
 * @returns {Deferred<T>} The promise and its resolvers.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}
