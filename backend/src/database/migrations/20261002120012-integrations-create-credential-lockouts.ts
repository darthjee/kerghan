import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const TABLE_NAME = 'integrations_credential_lockouts';

/**
 * Creates the Integrations module's `integrations_credential_lockouts` table, tracking the
 * per-user failure cool-off for creating an integration and replacing its credential (see
 * `IntegrationCredentialLockoutService`). Mirrors `auth_account_edit_lockouts`: `user_id` is
 * a logical foreign key into `auth_users` — no physical FK — and unique, since there is at
 * most one row per user, upserted in place.
 */
export class IntegrationsCreateCredentialLockouts20261002120012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'user_id', type: 'int' },
          { name: 'failed_attempts', type: 'int', default: 0 },
          { name: 'locked_until', type: 'datetime', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({
        name: 'idx_integrations_credential_lockouts_user_id',
        columnNames: ['user_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
