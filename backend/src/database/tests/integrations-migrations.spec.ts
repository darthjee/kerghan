import type { QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { IntegrationsCreateIntegrations20261002120011 } from '../migrations/20261002120011-integrations-create-integrations.js';
import {
  IntegrationsCreateCredentialLockouts20261002120012,
} from '../migrations/20261002120012-integrations-create-credential-lockouts.js';
import { IntegrationsCreateOauthStates20261002120013 } from '../migrations/20261002120013-integrations-create-oauth-states.js';
import {
  IntegrationsCreateGithubAppStates20261002120014,
} from '../migrations/20261002120014-integrations-create-github-app-states.js';

interface FakeQueryRunner {
  createTable: jest.Mock;
  createIndex: jest.Mock;
  createForeignKey: jest.Mock;
  dropTable: jest.Mock;
}

function fakeQueryRunner(): FakeQueryRunner {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    createIndex: jest.fn().mockResolvedValue(undefined),
    createForeignKey: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
}

function columnsOf(runner: FakeQueryRunner): Record<string, Record<string, unknown>> {
  const table = runner.createTable.mock.calls[0][0] as Table;

  return Object.fromEntries(table.columns.map((column) => [column.name, {
    type: column.type,
    length: column.length,
    isNullable: column.isNullable,
  }]));
}

function indexesOf(runner: FakeQueryRunner): Array<{ name?: string; columnNames: string[]; isUnique: boolean }> {
  return runner.createIndex.mock.calls.map(([, index]: [string, TableIndex]) => ({
    name: index.name,
    columnNames: index.columnNames,
    isUnique: index.isUnique,
  }));
}

describe('IntegrationsCreateIntegrations20261002120011', () => {
  const migration = new IntegrationsCreateIntegrations20261002120011();

  describe('up', () => {
    let runner: FakeQueryRunner;

    beforeEach(async () => {
      runner = fakeQueryRunner();
      await migration.up(runner as unknown as QueryRunner);
    });

    it('creates the integrations table if missing', () => {
      const [table, ifNotExists] = runner.createTable.mock.calls[0] as [Table, boolean];

      expect(table.name).toBe('integrations');
      expect(ifNotExists).toBe(true);
    });

    it('defines every column with its type, length and nullability', () => {
      expect(columnsOf(runner)).toEqual({
        id: { type: 'int', length: '', isNullable: false },
        uuid: { type: 'char', length: '36', isNullable: false },
        user_id: { type: 'int', length: '', isNullable: false },
        provider: { type: 'varchar', length: '32', isNullable: false },
        type: { type: 'varchar', length: '32', isNullable: false },
        label: { type: 'varchar', length: '100', isNullable: false },
        label_normalized: { type: 'varchar', length: '100', isNullable: false },
        status: { type: 'varchar', length: '32', isNullable: false },
        status_reason: { type: 'varchar', length: '64', isNullable: true },
        github_login: { type: 'varchar', length: '255', isNullable: false },
        expires_at: { type: 'datetime', length: '', isNullable: true },
        last_tested_at: { type: 'datetime', length: '', isNullable: true },
        last_test_result: { type: 'varchar', length: '32', isNullable: true },
        metadata: { type: 'json', length: '', isNullable: false },
        secret_hint: { type: 'varchar', length: '64', isNullable: true },
        secret_key_id: { type: 'char', length: '8', isNullable: false },
        secret_iv: { type: 'varbinary', length: '12', isNullable: false },
        secret_auth_tag: { type: 'varbinary', length: '16', isNullable: false },
        secret_ciphertext: { type: 'blob', length: '', isNullable: false },
        created_at: { type: 'datetime', length: '', isNullable: false },
        updated_at: { type: 'datetime', length: '', isNullable: false },
      });
    });

    it('creates the unique uuid, unique (user_id, label_normalized), user_id and secret_key_id indexes', () => {
      expect(indexesOf(runner)).toEqual([
        { name: 'idx_integrations_uuid', columnNames: ['uuid'], isUnique: true },
        {
          name: 'idx_integrations_user_id_label_normalized',
          columnNames: ['user_id', 'label_normalized'],
          isUnique: true,
        },
        { name: 'idx_integrations_user_id', columnNames: ['user_id'], isUnique: false },
        { name: 'idx_integrations_secret_key_id', columnNames: ['secret_key_id'], isUnique: false },
      ]);
      expect(runner.createIndex.mock.calls.every(([table]) => table === 'integrations')).toBe(true);
    });

    it('creates the cascading owner FK to auth_users', () => {
      const [table, fk] = runner.createForeignKey.mock.calls[0] as [string, TableForeignKey];

      expect(table).toBe('integrations');
      expect(fk).toMatchObject({
        name: 'fk_integrations_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'auth_users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
    });
  });

  describe('down', () => {
    it('drops the table (and its FK with it)', async () => {
      const runner = fakeQueryRunner();
      await migration.down(runner as unknown as QueryRunner);

      expect(runner.dropTable).toHaveBeenCalledWith('integrations');
      expect(runner.createTable).not.toHaveBeenCalled();
    });
  });
});

describe('IntegrationsCreateCredentialLockouts20261002120012', () => {
  const migration = new IntegrationsCreateCredentialLockouts20261002120012();

  describe('up', () => {
    let runner: FakeQueryRunner;

    beforeEach(async () => {
      runner = fakeQueryRunner();
      await migration.up(runner as unknown as QueryRunner);
    });

    it('creates the lockouts table with its columns', () => {
      const table = runner.createTable.mock.calls[0][0] as Table;

      expect(table.name).toBe('integrations_credential_lockouts');
      expect(columnsOf(runner)).toEqual({
        id: { type: 'int', length: '', isNullable: false },
        user_id: { type: 'int', length: '', isNullable: false },
        failed_attempts: { type: 'int', length: '', isNullable: false },
        locked_until: { type: 'datetime', length: '', isNullable: true },
        created_at: { type: 'datetime', length: '', isNullable: false },
        updated_at: { type: 'datetime', length: '', isNullable: false },
      });
      expect(table.columns.find((column) => column.name === 'failed_attempts')?.default).toBe(0);
    });

    it('creates a unique user_id index and no physical FK', () => {
      expect(indexesOf(runner)).toEqual([
        { name: 'idx_integrations_credential_lockouts_user_id', columnNames: ['user_id'], isUnique: true },
      ]);
      expect(runner.createForeignKey).not.toHaveBeenCalled();
    });
  });

  describe('down', () => {
    it('drops the table', async () => {
      const runner = fakeQueryRunner();
      await migration.down(runner as unknown as QueryRunner);

      expect(runner.dropTable).toHaveBeenCalledWith('integrations_credential_lockouts');
    });
  });
});

describe('IntegrationsCreateOauthStates20261002120013', () => {
  const migration = new IntegrationsCreateOauthStates20261002120013();

  describe('up', () => {
    let runner: FakeQueryRunner;

    beforeEach(async () => {
      runner = fakeQueryRunner();
      await migration.up(runner as unknown as QueryRunner);
    });

    it('creates the oauth states table if missing, with its columns', () => {
      const [table, ifNotExists] = runner.createTable.mock.calls[0] as [Table, boolean];

      expect(table.name).toBe('integrations_oauth_states');
      expect(ifNotExists).toBe(true);
      expect(columnsOf(runner)).toEqual({
        id: { type: 'int', length: '', isNullable: false },
        uuid: { type: 'char', length: '36', isNullable: false },
        user_id: { type: 'int', length: '', isNullable: false },
        secret_hash: { type: 'char', length: '64', isNullable: false },
        purpose: { type: 'varchar', length: '16', isNullable: false },
        label: { type: 'varchar', length: '100', isNullable: true },
        integration_uuid: { type: 'char', length: '36', isNullable: true },
        code_verifier: { type: 'varchar', length: '128', isNullable: false },
        expires_at: { type: 'datetime', length: '', isNullable: false },
        created_at: { type: 'datetime', length: '', isNullable: false },
      });
    });

    it('creates the unique uuid, user_id and expires_at indexes, and no physical FK', () => {
      expect(indexesOf(runner)).toEqual([
        { name: 'idx_integrations_oauth_states_uuid', columnNames: ['uuid'], isUnique: true },
        { name: 'idx_integrations_oauth_states_user_id', columnNames: ['user_id'], isUnique: false },
        { name: 'idx_integrations_oauth_states_expires_at', columnNames: ['expires_at'], isUnique: false },
      ]);
      expect(runner.createIndex.mock.calls.every(([table]) => table === 'integrations_oauth_states')).toBe(true);
      expect(runner.createForeignKey).not.toHaveBeenCalled();
    });
  });

  describe('down', () => {
    it('drops the table', async () => {
      const runner = fakeQueryRunner();
      await migration.down(runner as unknown as QueryRunner);

      expect(runner.dropTable).toHaveBeenCalledWith('integrations_oauth_states');
    });
  });
});

describe('IntegrationsCreateGithubAppStates20261002120014', () => {
  const migration = new IntegrationsCreateGithubAppStates20261002120014();

  describe('up', () => {
    let runner: FakeQueryRunner;

    beforeEach(async () => {
      runner = fakeQueryRunner();
      await migration.up(runner as unknown as QueryRunner);
    });

    it('creates the github app states table if missing, with its columns', () => {
      const [table, ifNotExists] = runner.createTable.mock.calls[0] as [Table, boolean];

      expect(table.name).toBe('integrations_github_app_states');
      expect(ifNotExists).toBe(true);
      expect(columnsOf(runner)).toEqual({
        id: { type: 'int', length: '', isNullable: false },
        uuid: { type: 'char', length: '36', isNullable: false },
        user_id: { type: 'int', length: '', isNullable: false },
        secret_hash: { type: 'char', length: '64', isNullable: false },
        stage: { type: 'varchar', length: '16', isNullable: false },
        purpose: { type: 'varchar', length: '16', isNullable: false },
        label: { type: 'varchar', length: '100', isNullable: true },
        integration_uuid: { type: 'char', length: '36', isNullable: true },
        candidate_installation_ids: { type: 'json', length: '', isNullable: true },
        verified_by: { type: 'varchar', length: '39', isNullable: true },
        expires_at: { type: 'datetime', length: '', isNullable: false },
        created_at: { type: 'datetime', length: '', isNullable: false },
      });
    });

    it('creates the unique uuid, user_id and expires_at indexes, and no physical FK', () => {
      expect(indexesOf(runner)).toEqual([
        { name: 'idx_integrations_github_app_states_uuid', columnNames: ['uuid'], isUnique: true },
        { name: 'idx_integrations_github_app_states_user_id', columnNames: ['user_id'], isUnique: false },
        { name: 'idx_integrations_github_app_states_expires_at', columnNames: ['expires_at'], isUnique: false },
      ]);
      expect(runner.createIndex.mock.calls.every(([table]) => table === 'integrations_github_app_states')).toBe(true);
      expect(runner.createForeignKey).not.toHaveBeenCalled();
    });
  });

  describe('down', () => {
    it('drops the table', async () => {
      const runner = fakeQueryRunner();
      await migration.down(runner as unknown as QueryRunner);

      expect(runner.dropTable).toHaveBeenCalledWith('integrations_github_app_states');
    });
  });
});
