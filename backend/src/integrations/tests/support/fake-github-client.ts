import {
  appInstallationResponse,
  FakeAppInstallationAnswer,
  FakeExchangeAnswer,
  FakeGithubAnswer,
  FakeInstallationsAnswer,
  FakeRevokeAnswer,
  FakeTokenAnswer,
  githubUserResponse,
  installationsPage,
  installationTokenResponse,
  oauthExchangeResponse,
} from './fake-github-answers.js';
import type {
  GithubAppClientService,
  GithubAppInstallationResponse,
  GithubInstallationsPage,
  GithubInstallationTokenResponse,
} from '../../github-app-client.service.js';
import type {
  GithubClientService,
  GithubUserResponse,
  OauthCodeExchangeRequest,
  OauthCodeExchangeResponse,
  OauthTokenRevocationRequest,
} from '../../github-client.service.js';
import type { Secret } from '../../secret.js';

export * from './fake-github-answers.js';

/**
 * Answers with the next queued answer (or the default), throwing errors.
 * @param {T[]} queue - The queued answers.
 * @param {T} fallback - The default answer.
 * @returns {Promise<Exclude<T, Error>>} The answer.
 */
async function answer<T>(queue: T[], fallback: T): Promise<Exclude<T, Error>> {
  const next = queue.shift() ?? fallback;

  if (next instanceof Error) {
    throw next;
  }

  return next as Exclude<T, Error>;
}

/**
 * Scriptable stand-in for `GithubClientService`. Answers are consumed in
 * order; once the queue is empty, the default answer is used. Every call is
 * recorded with its token still wrapped in a `Secret`, so an assertion
 * failure never prints the token.
 */
export class FakeGithubClient implements
  Pick<GithubClientService, 'getUser' | 'exchangeOauthCode' | 'revokeOauthToken'>,
  Pick<GithubAppClientService, 'listUserInstallations' | 'getAppInstallation' | 'createInstallationToken'> {
  readonly calls: Array<Secret<string>> = [];
  readonly installationsCalls: Array<{ token: Secret<string>; pageUrl: string | undefined }> = [];
  readonly appInstallationCalls: Array<{ jwt: Secret<string>; installationId: number }> = [];
  readonly tokenCalls: Array<{ jwt: Secret<string>; installationId: number }> = [];
  readonly installationsQueue: FakeInstallationsAnswer[] = [];
  readonly appInstallationQueue: FakeAppInstallationAnswer[] = [];
  readonly tokenQueue: FakeTokenAnswer[] = [];
  defaultInstallations: FakeInstallationsAnswer = installationsPage();
  defaultAppInstallation: FakeAppInstallationAnswer = appInstallationResponse();
  defaultToken: FakeTokenAnswer = installationTokenResponse();
  readonly exchangeCalls: OauthCodeExchangeRequest[] = [];
  readonly revokeCalls: OauthTokenRevocationRequest[] = [];
  readonly exchangeQueue: FakeExchangeAnswer[] = [];
  readonly revokeQueue: FakeRevokeAnswer[] = [];
  private readonly queue: FakeGithubAnswer[] = [];
  private defaultAnswer: FakeGithubAnswer = githubUserResponse();
  private defaultExchange: FakeExchangeAnswer = oauthExchangeResponse();
  private defaultRevoke: FakeRevokeAnswer = { status: 204 };

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
   * Queues code exchange answers, in order.
   * @param {...FakeExchangeAnswer} answers - The answers.
   * @returns {this} The fake, for chaining.
   */
  exchangeRespondWith(...answers: FakeExchangeAnswer[]): this {
    this.exchangeQueue.push(...answers);
    return this;
  }

  /**
   * Sets the code exchange answer used once its queue is empty.
   * @param {FakeExchangeAnswer} answer - The default answer.
   * @returns {this} The fake, for chaining.
   */
  exchangeRespondByDefault(answer: FakeExchangeAnswer): this {
    this.defaultExchange = answer;
    return this;
  }

  /**
   * Queues revocation answers, in order.
   * @param {...FakeRevokeAnswer} answers - The answers.
   * @returns {this} The fake, for chaining.
   */
  revokeRespondWith(...answers: FakeRevokeAnswer[]): this {
    this.revokeQueue.push(...answers);
    return this;
  }

  /**
   * Clears the queues and the recorded calls, and restores the default answers.
   * @returns {void}
   */
  reset(): void {
    this.calls.length = 0;
    this.exchangeCalls.length = 0;
    this.revokeCalls.length = 0;
    this.queue.length = 0;
    this.exchangeQueue.length = 0;
    this.revokeQueue.length = 0;
    this.defaultAnswer = githubUserResponse();
    this.defaultExchange = oauthExchangeResponse();
    this.defaultRevoke = { status: 204 };
    this.installationsCalls.length = 0;
    this.appInstallationCalls.length = 0;
    this.tokenCalls.length = 0;
    this.installationsQueue.length = 0;
    this.appInstallationQueue.length = 0;
    this.tokenQueue.length = 0;
    this.defaultInstallations = installationsPage();
    this.defaultAppInstallation = appInstallationResponse();
    this.defaultToken = installationTokenResponse();
  }

  /**
   * Records the call and answers with the next scripted installations page.
   * @param {Secret<string>} token - The user token.
   * @param {string} [pageUrl] - The page URL.
   * @returns {Promise<GithubInstallationsPage>} The scripted page.
   */
  async listUserInstallations(token: Secret<string>, pageUrl?: string): Promise<GithubInstallationsPage> {
    this.installationsCalls.push({ token, pageUrl });
    return answer(this.installationsQueue, this.defaultInstallations);
  }

  /**
   * Records the app-JWT call and answers with the next scripted installation.
   * @param {Secret<string>} jwt - The app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<GithubAppInstallationResponse>} The scripted answer.
   */
  async getAppInstallation(jwt: Secret<string>, installationId: number): Promise<GithubAppInstallationResponse> {
    this.appInstallationCalls.push({ jwt, installationId });
    return answer(this.appInstallationQueue, this.defaultAppInstallation);
  }

  /**
   * Records the app-JWT token mint and answers with the next scripted answer.
   * @param {Secret<string>} jwt - The app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<GithubInstallationTokenResponse>} The scripted answer.
   */
  async createInstallationToken(jwt: Secret<string>, installationId: number): Promise<GithubInstallationTokenResponse> {
    this.tokenCalls.push({ jwt, installationId });
    return answer(this.tokenQueue, this.defaultToken);
  }

  /**
   * @returns {number} How many app-JWT calls (installation lookups and token mints) were made.
   */
  get appJwtCallCount(): number {
    return this.appInstallationCalls.length + this.tokenCalls.length;
  }

  /**
   * Records the call and answers with the next scripted answer.
   * @param {Secret<string>} token - The token.
   * @returns {Promise<GithubUserResponse>} The scripted response.
   */
  async getUser(token: Secret<string>): Promise<GithubUserResponse> {
    this.calls.push(token);
    return answer(this.queue, this.defaultAnswer);
  }

  /**
   * Records the code exchange and answers with the next scripted answer.
   * @param {OauthCodeExchangeRequest} request - The exchange request (secrets still wrapped).
   * @returns {Promise<OauthCodeExchangeResponse>} The scripted answer.
   */
  async exchangeOauthCode(request: OauthCodeExchangeRequest): Promise<OauthCodeExchangeResponse> {
    this.exchangeCalls.push(request);
    return answer(this.exchangeQueue, this.defaultExchange);
  }

  /**
   * Records the revocation and answers with the next scripted answer.
   * @param {OauthTokenRevocationRequest} request - The revocation request (secrets still wrapped).
   * @returns {Promise<{ status: number }>} The scripted answer.
   */
  async revokeOauthToken(request: OauthTokenRevocationRequest): Promise<{ status: number }> {
    this.revokeCalls.push(request);
    return answer(this.revokeQueue, this.defaultRevoke);
  }

  /**
   * The tokens revoked so far, unwrapped (for assertions comparing them; never log them).
   * @returns {string[]} The revoked tokens.
   */
  get revokedTokens(): string[] {
    return this.revokeCalls.map((call) => call.token.reveal());
  }

  /**
   * @returns {number} How many GitHub calls of any kind were made.
   */
  get totalCallCount(): number {
    return this.calls.length + this.exchangeCalls.length + this.revokeCalls.length
      + this.installationsCalls.length + this.appJwtCallCount;
  }

  /**
   * @returns {number} How many `GET /user` calls were made.
   */
  get callCount(): number {
    return this.calls.length;
  }
}
