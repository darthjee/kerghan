import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_users';

/**
 * Adds `status` (`pending` | `approved` | `denied`) to `auth_users`. Every
 * existing row — including the demo seed users — is backfilled as
 * `approved`, since the session gate requires `approved` from this deploy on
 * and any user left without it would be locked out. The column is added
 * nullable, backfilled, then made NOT NULL (no default: the creating service
 * always sets it explicitly). Not guarded by `skipInProduction`: the
 * backfill is mandatory everywhere.
 */
export class AuthAddUsersStatus20261017120020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'status', type: 'varchar', length: '16', isNullable: true }),
    );

    await queryRunner.query(`UPDATE ${TABLE_NAME} SET status = 'approved'`);

    await queryRunner.changeColumn(
      TABLE_NAME,
      'status',
      new TableColumn({ name: 'status', type: 'varchar', length: '16', isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'status');
  }
}
