import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { AuthorizationRequest, type AuthorizationRequestStatus } from './entities/authorization-request.entity.js';

/**
 * Guarded authorization-request status transition: updates the row `uuid`
 * with `changes` only while its status is still `from`, in a single
 * conditional `UPDATE`, so concurrent polls can never both win it.
 * @param {Repository<AuthorizationRequest>} repository - The authorization-request repository.
 * @param {string} uuid - The authorization request's UUID.
 * @param {AuthorizationRequestStatus} from - The status the row must still have.
 * @param {QueryDeepPartialEntity<AuthorizationRequest>} changes - The columns to set.
 * @returns {Promise<boolean>} `true` when this call performed the transition.
 */
export async function guardedTransition(
  repository: Repository<AuthorizationRequest>,
  uuid: string,
  from: AuthorizationRequestStatus,
  changes: QueryDeepPartialEntity<AuthorizationRequest>,
): Promise<boolean> {
  const result = await repository
    .createQueryBuilder()
    .update()
    .set(changes)
    .where('uuid = :uuid AND status = :status', { uuid, status: from })
    .execute();

  return result.affected === 1;
}
