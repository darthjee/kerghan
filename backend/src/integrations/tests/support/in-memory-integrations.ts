import { QueryFailedError } from 'typeorm';
import type { Integration } from '../../entities/integration.entity.js';
import type { CooldownClaim } from '../../integration-test-cooldown.service.js';

type Where = Partial<Record<keyof Integration, unknown>>;

function matches(row: Integration, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => (row as never)[key] === value);
}

function duplicateEntry(): QueryFailedError {
  return new QueryFailedError('INSERT', [], Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' }));
}

/**
 * In-memory stand-in for `Repository<Integration>`, enforcing the unique
 * `uuid` and `(user_id, label_normalized)` indexes like MySQL would (an
 * `ER_DUP_ENTRY` `QueryFailedError`), and auto-filling the id and timestamps.
 */
export function createInMemoryIntegrationRepo() {
  const rows: Integration[] = [];
  let nextId = 1;

  const assertUnique = (candidate: Integration): void => {
    const clash = rows.some((row) => row.id !== candidate.id && (
      row.uuid === candidate.uuid
      || (row.userId === candidate.userId && row.labelNormalized === candidate.labelNormalized)
    ));

    if (clash) {
      throw duplicateEntry();
    }
  };

  return {
    rows,
    create: (attributes: Partial<Integration>): Integration => ({ ...attributes }) as Integration,
    find: async ({ where }: { where: Where }): Promise<Integration[]> =>
      rows
        .filter((row) => matches(row, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
        .map((row) => ({ ...row })),
    findOne: async ({ where }: { where: Where }): Promise<Integration | null> => {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    count: async ({ where }: { where: Where }): Promise<number> => rows.filter((row) => matches(row, where)).length,
    save: async (entity: Integration): Promise<Integration> => {
      const now = new Date();
      const row = { ...entity, id: nextId } as Integration;
      row.createdAt ??= now;
      row.updatedAt ??= now;
      assertUnique(row);
      nextId += 1;
      rows.push(row);
      return { ...row };
    },
    update: async (where: Where, changes: Partial<Integration>): Promise<{ affected: number }> => {
      const targets = rows.filter((row) => matches(row, where));

      targets.forEach((row) => assertUnique({ ...row, ...changes } as Integration));
      targets.forEach((row) => Object.assign(row, changes, { updatedAt: new Date() }));

      return { affected: targets.length };
    },
    delete: async (where: Where): Promise<{ affected: number }> => {
      const before = rows.length;
      rows.splice(0, rows.length, ...rows.filter((row) => !matches(row, where)));
      return { affected: before - rows.length };
    },
  };
}

/** The in-memory integration repository type. */
export type InMemoryIntegrationRepo = ReturnType<typeof createInMemoryIntegrationRepo>;

/**
 * In-memory double of `IntegrationTestCooldownService` with the same atomic
 * semantics: the check-and-set runs synchronously, so concurrent claims
 * on one integration let exactly one through per window.
 */
export class InMemoryTestCooldown {
  private readonly repo: InMemoryIntegrationRepo;
  private readonly cooldownMs: number;

  constructor(repo: InMemoryIntegrationRepo, cooldownMs = 30000) {
    this.repo = repo;
    this.cooldownMs = cooldownMs;
  }

  async claim(uuid: string, userId: number, now: Date = new Date()): Promise<CooldownClaim> {
    const row = this.repo.rows.find((candidate) => candidate.uuid === uuid && candidate.userId === userId);

    if (!row) {
      throw new Error('row vanished');
    }

    const last = row.lastTestedAt?.getTime() ?? null;

    if (last === null || last < now.getTime() - this.cooldownMs) {
      row.lastTestedAt = now;
      return { claimed: true };
    }

    return { claimed: false, retryAfterSeconds: Math.max(1, Math.ceil((last + this.cooldownMs - now.getTime()) / 1000)) };
  }
}

/**
 * In-memory double of `IntegrationCredentialAbuseGuardService` with the
 * same atomic semantics: the increment runs synchronously, so concurrent
 * failures all count.
 */
export class InMemoryCredentialAbuseGuard {
  readonly state = new Map<number, { failedAttempts: number; lockedUntil: Date | null }>();
  private readonly maxAttempts: number;
  private readonly lockMs: number;

  constructor(maxAttempts = 5, lockMs = 900000) {
    this.maxAttempts = maxAttempts;
    this.lockMs = lockMs;
  }

  async isLockedOut(userId: number): Promise<boolean> {
    const lockedUntil = this.state.get(userId)?.lockedUntil ?? null;

    return lockedUntil !== null && lockedUntil > new Date();
  }

  async registerFailure(userId: number): Promise<void> {
    const entry = this.state.get(userId) ?? { failedAttempts: 0, lockedUntil: null };
    entry.failedAttempts += 1;

    if (entry.failedAttempts >= this.maxAttempts) {
      entry.lockedUntil = new Date(Date.now() + this.lockMs);
    }

    this.state.set(userId, entry);
  }

  async reset(userId: number): Promise<void> {
    if (this.state.has(userId)) {
      this.state.set(userId, { failedAttempts: 0, lockedUntil: null });
    }
  }
}
