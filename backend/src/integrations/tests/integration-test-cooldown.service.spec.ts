import { NotFoundException } from '@nestjs/common';
import { Integration } from '../entities/integration.entity.js';
import { IntegrationTestCooldownService } from '../integration-test-cooldown.service.js';

const UUID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-01T12:00:00.000Z');

interface FakeQueryBuilder {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  execute: jest.Mock;
}

function fakeQueryBuilder(affected: number): FakeQueryBuilder {
  const builder = {} as FakeQueryBuilder;
  builder.update = jest.fn().mockReturnValue(builder);
  builder.set = jest.fn().mockReturnValue(builder);
  builder.where = jest.fn().mockReturnValue(builder);
  builder.andWhere = jest.fn().mockReturnValue(builder);
  builder.execute = jest.fn().mockResolvedValue({ affected });
  return builder;
}

function build(
  builder: FakeQueryBuilder,
  row: Partial<Integration> | null = null,
  env: Record<string, unknown> = {},
): { service: IntegrationTestCooldownService; repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock; save: jest.Mock } } {
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(builder),
    findOne: jest.fn().mockResolvedValue(row),
    save: jest.fn(),
  };
  const configService = { get: jest.fn((key: string) => env[key]) };

  return { service: new IntegrationTestCooldownService(repo as never, configService as never), repo };
}

describe('IntegrationTestCooldownService', () => {
  it('claims with a single owner-scoped conditional UPDATE', async () => {
    const builder = fakeQueryBuilder(1);
    const { service, repo } = build(builder);

    expect(await service.claim(UUID, 7, NOW)).toEqual({ claimed: true });
    expect(builder.update).toHaveBeenCalledWith(Integration);
    expect(builder.set).toHaveBeenCalledWith({ lastTestedAt: NOW });
    expect(builder.where).toHaveBeenCalledWith('uuid = :uuid AND user_id = :userId', { uuid: UUID, userId: 7 });
    expect(builder.andWhere).toHaveBeenCalledWith('(last_tested_at IS NULL OR last_tested_at < :threshold)', {
      threshold: new Date('2026-10-01T11:59:30.000Z'),
    });
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('uses the configured cooldown', async () => {
    const builder = fakeQueryBuilder(1);
    const { service } = build(builder, null, { KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS: '5000' });

    await service.claim(UUID, 7, NOW);

    expect(builder.andWhere.mock.calls[0][1]).toEqual({ threshold: new Date('2026-10-01T11:59:55.000Z') });
  });

  it.each([
    ['10s ago', '2026-10-01T11:59:50.000Z', 20],
    ['10.5s ago (rounded up)', '2026-10-01T11:59:49.500Z', 20],
    ['10.2s ago (rounded up)', '2026-10-01T11:59:49.800Z', 20],
    ['29.9s ago (at least 1)', '2026-10-01T11:59:30.100Z', 1],
    ['exactly at the window edge (at least 1)', '2026-10-01T11:59:30.000Z', 1],
    ['in the future after MySQL rounding (capped at the window)', '2026-10-01T12:00:00.400Z', 30],
  ])('answers the remaining seconds when tested %s', async (_label, lastTestedAt, retryAfterSeconds) => {
    const { service, repo } = build(fakeQueryBuilder(0), { lastTestedAt: new Date(lastTestedAt) });

    expect(await service.claim(UUID, 7, NOW)).toEqual({ claimed: false, retryAfterSeconds });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { uuid: UUID, userId: 7 },
      select: { id: true, lastTestedAt: true },
    });
  });

  it('answers at least 1 second when the stored date is missing', async () => {
    const { service } = build(fakeQueryBuilder(0), { lastTestedAt: null });

    expect(await service.claim(UUID, 7, NOW)).toEqual({ claimed: false, retryAfterSeconds: 1 });
  });

  it('answers 404 when the row is gone', async () => {
    const { service } = build(fakeQueryBuilder(0), null);

    await expect(service.claim(UUID, 7, NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults now to the current time', async () => {
    const builder = fakeQueryBuilder(1);
    const { service } = build(builder);

    await service.claim(UUID, 7);

    expect(builder.set.mock.calls[0][0].lastTestedAt).toBeInstanceOf(Date);
  });
});
