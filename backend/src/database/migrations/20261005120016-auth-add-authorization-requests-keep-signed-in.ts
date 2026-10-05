import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_authorization_requests';

/**
 * Adds the `keep_signed_in` flag to `auth_authorization_requests`, recording
 * whether the requesting device asked for a persistent ("keep me signed in")
 * session, so the winning poll mints the session with the matching TTL.
 * Defaults to `false` so every existing request stays a regular session.
 */
export class AuthAddAuthorizationRequestsKeepSignedIn20261005120016 implements MigrationInterface {
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
