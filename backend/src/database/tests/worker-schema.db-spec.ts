import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { workerSchemaName } from './db-tier/db-tier-options.js';
import { getTestDataSource } from './db-tier/db-tier.js';

// Same connection wiring as `AppModule`'s `TypeOrmModule.forRootAsync`
// (database name read through `ConfigService`).
@Module({
  imports: [
    ConfigModule.forRoot({ ignoreEnvFile: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('KERGHAN_MYSQL_HOST'),
        port: config.get<number>('KERGHAN_MYSQL_PORT', 3306),
        username: config.get<string>('KERGHAN_MYSQL_USER'),
        password: config.get<string>('KERGHAN_MYSQL_PASSWORD'),
        database: config.get<string>('KERGHAN_MYSQL_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
  ],
})
class ConfigDbModule {}

async function currentSchema(ds: DataSource): Promise<string> {
  const rows: Array<{ name: string }> = await ds.query('SELECT DATABASE() AS name');

  return rows[0].name;
}

describe('DB test tier worker isolation', () => {
  const expected = workerSchemaName(process.env.KERGHAN_MYSQL_BASE_NAME ?? '', Number(process.env.JEST_WORKER_ID));

  it('points the shared test data source at this worker schema', async () => {
    expect(await currentSchema(await getTestDataSource())).toBe(expected);
  });

  it('points a config-built Nest connection at this worker schema', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ConfigDbModule] }).compile();

    try {
      expect(await currentSchema(moduleRef.get(DataSource))).toBe(expected);
    } finally {
      await moduleRef.close();
    }
  });

  it('hides the admin credentials from specs', () => {
    expect(process.env.KERGHAN_MYSQL_ADMIN_USER).toBeUndefined();
    expect(process.env.KERGHAN_MYSQL_ADMIN_PASSWORD).toBeUndefined();
  });
});
