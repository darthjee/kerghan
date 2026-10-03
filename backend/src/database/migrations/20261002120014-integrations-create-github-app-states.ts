import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn } from './helpers.js';

const TABLE_NAME = 'integrations_github_app_states';

/**
 * Creates the Integrations module's `integrations_github_app_states` table:
 * one server-side, single-use row per started GitHub App flow step
 * (`redirect` or `select`, see `GithubAppStateService`). `user_id` is a
 * logical foreign key into `auth_users` — no physical FK. Rows live 10
 * minutes and are purged on every start and selection; no background job.
 */
export class IntegrationsCreateGithubAppStates20261002120014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TABLE_NAME,
        columns: [
          idColumn(),
          { name: 'uuid', type: 'char', length: '36' },
          { name: 'user_id', type: 'int' },
          { name: 'secret_hash', type: 'char', length: '64' },
          { name: 'stage', type: 'varchar', length: '16' },
          { name: 'purpose', type: 'varchar', length: '16' },
          { name: 'label', type: 'varchar', length: '100', isNullable: true },
          { name: 'integration_uuid', type: 'char', length: '36', isNullable: true },
          { name: 'candidate_installation_ids', type: 'json', isNullable: true },
          { name: 'expires_at', type: 'datetime' },
          createdAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_github_app_states_uuid', columnNames: ['uuid'], isUnique: true }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_github_app_states_user_id', columnNames: ['user_id'] }),
    );
    await queryRunner.createIndex(
      TABLE_NAME,
      new TableIndex({ name: 'idx_integrations_github_app_states_expires_at', columnNames: ['expires_at'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(TABLE_NAME);
  }
}
