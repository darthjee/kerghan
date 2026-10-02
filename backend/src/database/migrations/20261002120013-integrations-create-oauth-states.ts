import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'integrations_oauth_states';

/**
 * Creates the Integrations module's `integrations_oauth_states` table: one
 * server-side, single-use row per started OAuth App redirect flow (see
 * `OauthStateService`). Like `integrations_credential_lockouts`, `user_id`
 * is a logical foreign key into `auth_users` — no physical FK. Rows live
 * 10 minutes and are purged on every start; no background job.
 */
export class IntegrationsCreateOauthStates20261002120013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'uuid', type: 'char', length: '36' },
          { name: 'user_id', type: 'int' },
          { name: 'secret_hash', type: 'char', length: '64' },
          { name: 'purpose', type: 'varchar', length: '16' },
          { name: 'label', type: 'varchar', length: '100', isNullable: true },
          { name: 'integration_uuid', type: 'char', length: '36', isNullable: true },
          { name: 'code_verifier', type: 'varchar', length: '128' },
          { name: 'expires_at', type: 'datetime' },
          createdAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_oauth_states_uuid', columnNames: ['uuid'], isUnique: true }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_oauth_states_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_oauth_states_expires_at', columnNames: ['expires_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
