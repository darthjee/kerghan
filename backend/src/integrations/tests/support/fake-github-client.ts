import type { GithubClientService, GithubUserResponse } from '../../github-client.service.js';
import type { Secret } from '../../secret.js';

/** A scripted answer: a response, or an error to throw (e.g. a `GithubClientError`). */
export type FakeGithubAnswer = GithubUserResponse | Error;

/**
 * Builds a `GET /user` response with sensible defaults.
 * @param {Partial<GithubUserResponse>} overrides - Fields to override.
 * @returns {GithubUserResponse} The response.
 */
export function githubUserResponse(overrides: Partial<GithubUserResponse> = {}): GithubUserResponse {
  return {
    status: 200,
    login: 'octocat',
    oauthScopes: 'repo, read:org',
    tokenExpiration: null,
    rateLimitRemaining: 4999,
    rateLimitReset: null,
    retryAfter: null,
    ...overrides,
  };
}

/**
 * Scriptable stand-in for `GithubClientService`. Answers are consumed in
 * order; once the queue is empty, the default answer is used. Every call is
 * recorded with its token still wrapped in a `Secret`, so an assertion
 * failure never prints the token.
 */
export class FakeGithubClient implements Pick<GithubClientService, 'getUser'> {
  readonly calls: Array<Secret<string>> = [];
  private readonly queue: FakeGithubAnswer[] = [];
  private defaultAnswer: FakeGithubAnswer = githubUserResponse();

  /**
   * Queues answers for the next calls, in order.
   * @param {...FakeGithubAnswer} answers - The answers.
   * @returns {this} The fake, for chaining.
   */
  respondWith(...answers: FakeGithubAnswer[]): this {
    this.queue.push(...answers);
    return this;
  }

  /**
   * Sets the answer used once the queue is empty.
   * @param {FakeGithubAnswer} answer - The default answer.
   * @returns {this} The fake, for chaining.
   */
  respondByDefault(answer: FakeGithubAnswer): this {
    this.defaultAnswer = answer;
    return this;
  }

  /**
   * Clears the queue and the recorded calls, and restores the default answer.
   * @returns {void}
   */
  reset(): void {
    this.calls.length = 0;
    this.queue.length = 0;
    this.defaultAnswer = githubUserResponse();
  }

  /**
   * Records the call and answers with the next scripted answer.
   * @param {Secret<string>} token - The token.
   * @returns {Promise<GithubUserResponse>} The scripted response.
   */
  async getUser(token: Secret<string>): Promise<GithubUserResponse> {
    this.calls.push(token);
    const answer = this.queue.shift() ?? this.defaultAnswer;

    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
  }

  /**
   * @returns {number} How many GitHub calls were made.
   */
  get callCount(): number {
    return this.calls.length;
  }
}
