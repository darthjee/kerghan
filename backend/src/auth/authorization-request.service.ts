import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthorizationRequest, type AuthorizationRequestStatus } from './entities/authorization-request.entity.js';
import { User } from './entities/user.entity.js';
import { AuthorizationRequestCreatedEvent } from './events/authorization-request-created.event.js';
import { AuthorizationRequestLoggedEvent } from './events/authorization-request-logged.event.js';
import { TokenService, type AuthResult } from './token.service.js';

// Default authorization-request lifetime (1 hour, in milliseconds) used when
// `KERGHAN_AUTHORIZATION_REQUEST_TTL_MS` is unset.
const DEFAULT_AUTHORIZATION_REQUEST_TTL_MS = 3600000;

/** The result of `create()`. */
export interface CreatedAuthorizationRequest {
  uuid: string;
  pollToken: string;
  expiresAt: Date;
}

/**
 * The result of `poll()`: every non-`approved` status carries no
 * credentials; `approved` (the winning poll only) carries the freshly
 * issued session.
 */
export type PollResult =
  | { status: Exclude<AuthorizationRequestStatus, 'approved'> }
  | { status: 'approved'; authResult: AuthResult };

/**
 * The requesting-device half of the login-by-authorization flow's business
 * logic: creating an `AuthorizationRequest` for a username, and polling it
 * until it is approved (or denied / expired). Not exported from
 * `AuthModule` — an internal collaborator only, like `PasswordResetService`.
 * Depends only on injected repositories and services — never reads env vars
 * or global state directly (per `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AuthorizationRequestService {
  private readonly authorizationRequestRepository: Repository<AuthorizationRequest>;
  private readonly userRepository: Repository<User>;
  private readonly tokenService: TokenService;
  private readonly eventEmitter: EventEmitter2;
  private readonly configService: ConfigService;

  /**
   * @param {Repository<AuthorizationRequest>} authorizationRequestRepository - The
   *   authorization-request repository.
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {TokenService} tokenService - Mints the session on a successful poll claim.
   * @param {EventEmitter2} eventEmitter - Fires the `authorization-request.created`/`.logged` events.
   * @param {ConfigService} configService - Supplies the authorization-request TTL.
   */
  constructor(
    @InjectRepository(AuthorizationRequest) authorizationRequestRepository: Repository<AuthorizationRequest>,
    @InjectRepository(User) userRepository: Repository<User>,
      tokenService: TokenService,
      eventEmitter: EventEmitter2,
      configService: ConfigService,
  ) {
    this.authorizationRequestRepository = authorizationRequestRepository;
    this.userRepository = userRepository;
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    this.configService = configService;
  }

  /**
   * Creates an `open` authorization request for `username`. Never branches
   * its return shape (or timing) on whether `username` resolves to a real
   * user, per the enumeration-safety contract — a non-matching username
   * stores `userId: null` and such a row can never be approved.
   * @param {string} username - The username the requesting device asks another device to vouch for.
   * @param {string} ip - The requesting device's IP address.
   * @param {string} userAgent - The requesting device's User-Agent string.
   * @returns {Promise<CreatedAuthorizationRequest>} The new request's UUID,
   *   plaintext poll token (only its hash is persisted), and expiry.
   */
  async create(username: string, ip: string, userAgent: string): Promise<CreatedAuthorizationRequest> {
    const user = await this.userRepository.findOneBy({ username });
    const pollToken = randomBytes(48).toString('hex');
    const uuid = randomUUID();
    const expiresAt = new Date(Date.now() + this.#ttlMs());

    await this.authorizationRequestRepository.save(
      this.authorizationRequestRepository.create({
        uuid,
        username,
        userId: user?.id ?? null,
        status: 'open',
        pollTokenHash: this.#hashToken(pollToken),
        requestIp: ip,
        requestUserAgent: userAgent,
        approvedByUserId: null,
        expiresAt,
        resolvedAt: null,
        loggedAt: null,
      }),
    );

    this.eventEmitter.emit(
      'authorization-request.created',
      new AuthorizationRequestCreatedEvent(uuid, username, user?.id ?? null),
    );

    return { uuid, pollToken, expiresAt };
  }

  /**
   * Polls an authorization request's status. Unknown `uuid` and wrong
   * `pollToken` are indistinguishable — both throw the same
   * `NotFoundException`. An `open` request past its `expiresAt` is lazily
   * flipped to `expired`. An `approved` request is claimed atomically: only
   * the first poll to win the guarded `UPDATE` mints a session; every other
   * (later or losing) poll gets `{ status: 'logged' }` with no credentials.
   * @param {string} uuid - The authorization request's UUID.
   * @param {string} pollToken - The plaintext poll token issued by `create()`.
   * @returns {Promise<PollResult>} The current status, with a freshly issued
   *   session attached only for the winning `approved` poll.
   * @throws {NotFoundException} When `uuid` is unknown or `pollToken` is wrong.
   */
  async poll(uuid: string, pollToken: string): Promise<PollResult> {
    const request = await this.authorizationRequestRepository.findOneBy({
      uuid,
      pollTokenHash: this.#hashToken(pollToken),
    });

    if (!request) {
      throw new NotFoundException('Authorization request not found');
    }

    if (request.status === 'open' && request.expiresAt < new Date()) {
      return this.#expire(request);
    }

    if (request.status === 'approved') {
      return this.#claim(request);
    }

    return { status: request.status };
  }

  async #expire(request: AuthorizationRequest): Promise<PollResult> {
    await this.authorizationRequestRepository.update(request.id, {
      status: 'expired',
      resolvedAt: new Date(),
    });

    return { status: 'expired' };
  }

  async #claim(request: AuthorizationRequest): Promise<PollResult> {
    const result = await this.authorizationRequestRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'logged', loggedAt: () => 'CURRENT_TIMESTAMP' })
      .where('uuid = :uuid AND status = :status', { uuid: request.uuid, status: 'approved' })
      .execute();

    if (result.affected !== 1) {
      return { status: 'logged' };
    }

    return this.#issueSessionFor(request);
  }

  async #issueSessionFor(request: AuthorizationRequest): Promise<PollResult> {
    const user = request.userId === null ? null : await this.userRepository.findOneBy({ id: request.userId });

    if (!user) {
      return { status: 'logged' };
    }

    const authResult = await this.tokenService.issueTokens(user);

    this.eventEmitter.emit(
      'authorization-request.logged',
      new AuthorizationRequestLoggedEvent(request.uuid, user.id),
    );

    return { status: 'approved', authResult };
  }

  #ttlMs(): number {
    return Number(
      this.configService.get('KERGHAN_AUTHORIZATION_REQUEST_TTL_MS') ?? DEFAULT_AUTHORIZATION_REQUEST_TTL_MS,
    );
  }

  #hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
