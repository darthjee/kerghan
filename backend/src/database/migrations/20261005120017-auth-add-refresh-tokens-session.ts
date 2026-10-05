import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn, TableIndex } from 'typeorm';

const TABLE_NAME = 'auth_refresh_tokens';
const INDEX_NAME = 'idx_auth_refresh_tokens_session_uuid';

/**
 * Adds the session identity to `auth_refresh_tokens`: `session_uuid` (shared
 * by every token of one rotation chain) and `started_at` (when the chain's
 * login happened). Existing rows are backfilled as one session each, with
 * `started_at` = `issued_at`, before both columns become `NOT NULL`. The
 * index on `session_uuid` is non-unique, since a rotated chain leaves several
 * rows per session.
 */
export class AuthAddRefreshTokensSession20261005120017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns(TABLE_NAME, [
      new TableColumn({ name: 'session_uuid', type: 'varchar', length: '36', isNullable: true }),
      new TableColumn({ name: 'started_at', type: 'datetime', isNullable: true }),
    ]);

    await queryRunner.query(
      `UPDATE ${TABLE_NAME} SET session_uuid = UUID(), started_at = issued_at`,
    );
    await queryRunner.query(
      `ALTER TABLE ${TABLE_NAME} MODIFY session_uuid varchar(36) NOT NULL, MODIFY started_at datetime NOT NULL`,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: INDEX_NAME, columnNames: ['session_uuid'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(TABLE_NAME, INDEX_NAME);
    await queryRunner.dropColumn(TABLE_NAME, 'started_at');
    await queryRunner.dropColumn(TABLE_NAME, 'session_uuid');
  }
}
