import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'auth_sessions';

/**
 * Drops the Auth module's write-only `auth_sessions` table: nothing ever read
 * it (logoff, refresh and the session list/revoke all run on
 * `auth_refresh_tokens`). `down` recreates the table empty, exactly as
 * `20260824120003-auth-create-sessions` defines it — the rows it held are not
 * recoverable.
 */
export class AuthDropSessions20261009120019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'user_id', type: 'int' },
          createdAtColumn(),
          { name: 'last_seen_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_sessions_user_id', columnNames: ['user_id'] }),
    );
  }
}
