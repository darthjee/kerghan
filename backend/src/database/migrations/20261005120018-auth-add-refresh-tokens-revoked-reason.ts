import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_refresh_tokens';

/**
 * Adds `revoked_reason` to `auth_refresh_tokens`, recording why a token was
 * revoked so only a replayed *rotated* token triggers replay detection.
 * Already-revoked rows can't tell rotation from logout, so they are
 * backfilled as `rotated`, preserving the replay detection they had before
 * this column existed (bounded by their expiry, which is now checked first).
 * Unrevoked rows stay `NULL`.
 */
export class AuthAddRefreshTokensRevokedReason20261005120018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'revoked_reason', type: 'varchar', length: '32', isNullable: true }),
    );

    await queryRunner.query(
      `UPDATE ${TABLE_NAME} SET revoked_reason = 'rotated' WHERE revoked_at IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'revoked_reason');
  }
}
