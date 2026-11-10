import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_users';

/**
 * Adds the nullable `github_handle` (`varchar(39)`, default `null`) to
 * `auth_users`: the account's optional GitHub handle, owned by Auth. No
 * index and no uniqueness (nothing looks a user up by handle, and two
 * accounts may hold the same one). No backfill: every existing row is
 * `null`, meaning "no handle".
 */
export class AuthAddUsersGithubHandle20261110120021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({
        name: 'github_handle',
        type: 'varchar',
        length: '39',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'github_handle');
  }
}
