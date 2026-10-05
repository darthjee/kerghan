import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_refresh_tokens';

/**
 * Adds the `keep_signed_in` flag to `auth_refresh_tokens`, marking a refresh
 * token as part of a persistent ("keep me signed in") session so it is
 * minted with the longer TTL and the flag carries over on rotation.
 * Defaults to `false` so every existing token stays a regular session.
 */
export class AuthAddRefreshTokensKeepSignedIn20261005120015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'keep_signed_in', type: 'boolean', default: false, isNullable: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'keep_signed_in');
  }
}
