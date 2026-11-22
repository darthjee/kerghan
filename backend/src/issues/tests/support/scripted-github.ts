import { githubIssue, issue, issuePage, jsonResponse, type GithubCase } from '../../../integrations/tests/support/github-builders.js';
import { CANARY_INSTALLATION_TOKEN } from '../../../integrations/tests/support/integrations-github-harness.js';
import { UnexpectedNetworkCall } from '../../../integrations/tests/support/no-network-guard.js';

/** One request the real Integrations clients sent to the scripted GitHub. */
export interface ScriptedCall {
  method: string;
  url: string;
  /** The `Authorization` header: it is the credential on the wire, which only the clients may ever see. */
  authorization: string | null;
}

/** What a request is answered with: the mint, or the scripted case of that name. */
const ROUTES: Array<{ method: string; pattern: RegExp; target: 'mint' | 'reads' | 'probes' | 'writes' }> = [
  { method: 'POST', pattern: /\/app\/installations\/\d+\/access_tokens$/, target: 'mint' },
  { method: 'PATCH', pattern: /\/repos\/[^/]+\/[^/]+\/issues\/\d+$/, target: 'writes' },
  { method: 'GET', pattern: /\/repos\/[^/]+\/[^/]+\/issues\?per_page=1$/, target: 'probes' },
  { method: 'GET', pattern: /\/repos\/[^/]+\/[^/]+\/issues\/\d+$/, target: 'reads' },
];

/**
 * GitHub, mocked at the `fetch` level for the canary sweeps: the real Integrations services run
 * and send real requests (credentials included), and this answers them. Routes:
 * `GET /repos/{owner}/{name}/issues/{n}` answers the `reads` case, `GET .../issues?per_page=1` (the
 * access probe) the `probes` case, `PATCH .../issues/{n}` the `writes` case, and the GitHub App's
 * installation-token mint answers a `ghs_` canary token. Any other request throws like the
 * no-network guard.
 */
export class ScriptedGithub {
  readonly calls: ScriptedCall[] = [];
  readonly fetch: jest.Mock;
  readonly #now: () => Date;
  readonly #taken = new Map<GithubCase, number>();
  #reads: GithubCase = issue(githubIssue({ number: 12, title: 'T', body: 'B' }), { etag: 'W/"g1"' });
  #probes: GithubCase = issuePage([]);
  #writes: GithubCase = issue(githubIssue({ number: 12, title: 'T', body: 'B' }), { etag: 'W/"g2"' });
  #original: typeof fetch | undefined;

  /**
   * @param now - The harness clock, for the mint's expiry.
   */
  constructor(now: () => Date) {
    this.#now = now;
    this.fetch = jest.fn((url: unknown, init?: RequestInit) => this.#answer(String(url), init));
  }

  /** Scripts the answer of the issue `GET`. */
  reads(answer: GithubCase): this {
    this.#reads = answer;

    return this;
  }

  /** Scripts the answer of the access probe (`GET .../issues?per_page=1`). */
  probes(answer: GithubCase): this {
    this.#probes = answer;

    return this;
  }

  /** Scripts the answer of the issue `PATCH`. */
  writes(answer: GithubCase): this {
    this.#writes = answer;

    return this;
  }

  /** Replaces `globalThis.fetch` with the script. */
  install(): void {
    this.#original = globalThis.fetch;
    globalThis.fetch = this.fetch as unknown as typeof fetch;
  }

  /** Puts the original `fetch` back. */
  restore(): void {
    if (this.#original) globalThis.fetch = this.#original;
    this.#original = undefined;
  }

  /** Forgets the recorded calls. */
  clear(): void {
    this.calls.length = 0;
    this.#taken.clear();
    this.fetch.mockClear();
  }

  /** The recorded calls to the issue endpoints (the mint excluded). */
  issueCalls(): ScriptedCall[] {
    return this.calls.filter((call) => !call.url.includes('/access_tokens'));
  }

  async #answer(url: string, init: RequestInit | undefined): Promise<Response> {
    const method = init?.method ?? 'GET';
    const headers = init?.headers as Record<string, string> | undefined;

    this.calls.push({ method, url, authorization: headers?.Authorization ?? headers?.authorization ?? null });

    const route = ROUTES.find((candidate) => candidate.method === method && candidate.pattern.test(url));

    if (route === undefined) throw new UnexpectedNetworkCall(url);
    if (route.target === 'mint') return this.#mint();

    return this.#respond(this.#scripted(route.target));
  }

  #scripted(target: 'reads' | 'probes' | 'writes'): GithubCase {
    return { reads: this.#reads, probes: this.#probes, writes: this.#writes }[target];
  }

  #mint(): Response {
    return jsonResponse(201, { token: CANARY_INSTALLATION_TOKEN, expires_at: new Date(this.#now().getTime() + 3_600_000).toISOString() });
  }

  #respond(answer: GithubCase): Response {
    const { raw } = answer;

    if (raw === null) throw new Error(`${answer.name} makes no GitHub call`);
    if (typeof raw === 'function') return raw('array');
    if ('throws' in raw) throw raw.throws();

    const index = this.#taken.get(answer) ?? 0;

    this.#taken.set(answer, index + 1);

    return raw.sequence[Math.min(index, raw.sequence.length - 1)]();
  }
}
