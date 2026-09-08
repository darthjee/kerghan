import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

const TABLE_NAME = 'auth_authorization_requests';
const STATUS_ENUM = ['open', 'approved', 'denied', 'logged', 'expired'];

/**
 * Creates the Auth module's `auth_authorization_requests` table. `user_id`
 * is a logical foreign key into `auth_users` — no physical FK, per the
 * module's database strategy (see docs/agents/architecture/backend.md).
 */
export class AuthCreateAuthorizationRequests20260903120008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'uuid', type: 'varchar', length: '36', isUnique: true },
          { name: 'username', type: 'varchar' },
          { name: 'user_id', type: 'int', isNullable: true },
          { name: 'status', type: 'enum', enum: STATUS_ENUM, default: "'open'" },
          { name: 'poll_token_hash', type: 'varchar', isUnique: true },
          { name: 'request_ip', type: 'varchar', length: '45' },
          { name: 'request_user_agent', type: 'varchar', length: '512' },
          { name: 'approved_by_user_id', type: 'int', isNullable: true },
          { name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'expires_at', type: 'datetime' },
          { name: 'resolved_at', type: 'datetime', isNullable: true },
          { name: 'logged_at', type: 'datetime', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_authorization_requests_uuid', columnNames: ['uuid'], isUnique: true }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({
        name: 'idx_auth_authorization_requests_poll_token_hash',
        columnNames: ['poll_token_hash'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({
        name: 'idx_auth_authorization_requests_user_id_status',
        columnNames: ['user_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_auth_authorization_requests_expires_at', columnNames: ['expires_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
