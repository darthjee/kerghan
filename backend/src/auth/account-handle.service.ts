import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

/**
 * Auth's read-only export of the account's GitHub handle, for other modules
 * (the Repositories module reads the handle through it, never from
 * `auth_users` directly). Only Auth writes the column, through
 * `PATCH /auth/account.json`.
 */
@Injectable()
export class AccountHandleService {
  private readonly userRepository: Repository<User>;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   */
  constructor(@InjectRepository(User) userRepository: Repository<User>) {
    this.userRepository = userRepository;
  }

  /**
   * Reads a user's stored GitHub handle.
   * @param {number} userId - The id of the user.
   * @returns {Promise<string | null>} The stored, normalised handle, or `null`
   *   when the user has no handle or does not exist.
   */
  async getGithubHandle(userId: number): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, githubHandle: true },
    });

    return user?.githubHandle ?? null;
  }

  /**
   * Checks, inside the caller's transaction, that a user still exists, and
   * holds a shared lock (`SELECT … FOR SHARE`) on its row until that
   * transaction ends, so a concurrent user delete waits for the caller's
   * commit (its `user.deleted` listener then removes whatever the caller
   * wrote). This is the only cross-module read the Repositories module may
   * run inside its own transaction; Auth still owns the query.
   * @param {number} userId - The id of the user.
   * @param {EntityManager} manager - The caller's transactional entity manager.
   * @returns {Promise<boolean>} Whether the user row exists.
   */
  async lockExistingUser(userId: number, manager: EntityManager): Promise<boolean> {
    const user = await manager.getRepository(User)
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.id = :userId', { userId })
      .setLock('pessimistic_read')
      .getOne();

    return user !== null;
  }
}
