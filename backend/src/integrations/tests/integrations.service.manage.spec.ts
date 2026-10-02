import { HttpException } from '@nestjs/common';
import { buildIntegrationsHarness, CANARY_CLASSIC, CANARY_FRAGMENT, IntegrationsHarness } from './support/integrations-harness.js';

const USER = 7;
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

function envelope(label = 'Work'): never {
  return { label, provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC } } as never;
}

async function statusOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    return { status: exception.getStatus(), body: exception.getResponse() };
  }

  throw new Error('expected an HttpException');
}

describe('IntegrationsService (list, show, rename, delete, types)', () => {
  let harness: IntegrationsHarness;

  beforeEach(() => {
    harness = buildIntegrationsHarness();
  });

  describe('list', () => {
    it('lists only the caller\'s integrations, newest first, without decrypting', async () => {
      await harness.service.create(USER, envelope('First'));
      await harness.service.create(USER, envelope('Second'));
      await harness.service.create(8, envelope('Foreign'));
      harness.repo.rows[0].createdAt = new Date('2026-01-01T00:00:00Z');
      harness.repo.rows[1].createdAt = new Date('2026-02-01T00:00:00Z');
      const decrypt = jest.spyOn(harness.encryption, 'decrypt');

      const list = await harness.service.list(USER);

      expect(list.map((integration) => integration.label)).toEqual(['Second', 'First']);
      expect(decrypt).not.toHaveBeenCalled();
      expect(JSON.stringify(list)).not.toContain(CANARY_FRAGMENT);
    });

    it('breaks createdAt ties by id', async () => {
      await harness.service.create(USER, envelope('First'));
      await harness.service.create(USER, envelope('Second'));
      const at = new Date('2026-01-01T00:00:00Z');
      harness.repo.rows.forEach((row) => { row.createdAt = at; });

      expect((await harness.service.list(USER)).map((integration) => integration.label)).toEqual(['Second', 'First']);
    });

    it('never returns the internal id, the owner or any secret column', async () => {
      await harness.service.create(USER, envelope());

      const [integration] = await harness.service.list(USER);

      expect(Object.keys(integration).sort()).toEqual([
        'createdAt', 'expiresAt', 'githubLogin', 'id', 'label', 'lastTestResult', 'lastTestedAt', 'metadata',
        'nextTestAt', 'provider', 'secretHint', 'status', 'statusReason', 'type', 'updatedAt',
      ]);
    });

    it('reports a row on an unknown key id as undecryptable, with a null hint', async () => {
      await harness.service.create(USER, envelope());
      harness.repo.rows[0].secretKeyId = 'deadbeef';

      expect(await harness.service.list(USER)).toEqual([
        expect.objectContaining({ status: 'undecryptable', secretHint: null }),
      ]);
    });

    it('reports a stored undecryptable row with a null hint', async () => {
      await harness.service.create(USER, envelope());
      harness.repo.rows[0].status = 'undecryptable';

      expect((await harness.service.list(USER))[0]).toMatchObject({ status: 'undecryptable', secretHint: null });
    });
  });

  describe('expiry on read', () => {
    it('reports an active row past expiresAt as expired, without changing the stored status', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.repo.rows[0].expiresAt = new Date('2000-01-01T00:00:00Z');

      expect((await harness.service.list(USER))[0].status).toBe('expired');
      expect((await harness.service.show(USER, id)).status).toBe('expired');
      expect(harness.repo.rows[0].status).toBe('active');
    });

    it('reports a non-active row as stored', async () => {
      const { id } = await harness.service.create(USER, envelope());
      Object.assign(harness.repo.rows[0], {
        status: 'invalid',
        statusReason: 'bad_credentials',
        expiresAt: new Date('2000-01-01T00:00:00Z'),
      });

      expect(await harness.service.show(USER, id)).toMatchObject({ status: 'invalid', statusReason: 'bad_credentials' });
    });

    it('keeps an active row with a future expiry active', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.repo.rows[0].expiresAt = new Date('2999-01-01T00:00:00Z');

      expect((await harness.service.show(USER, id)).status).toBe('active');
    });
  });

  describe('show', () => {
    it('shows the caller\'s integration', async () => {
      const { id } = await harness.service.create(USER, envelope());

      expect(await harness.service.show(USER, id)).toMatchObject({ id, label: 'Work' });
    });

    it.each([
      ['a missing uuid', MISSING_UUID],
      ['a malformed uuid', 'not-a-uuid'],
    ])('answers 404 for %s', async (_label, uuid) => {
      expect((await statusOf(harness.service.show(USER, uuid))).status).toBe(404);
    });

    it('answers the same 404 for a foreign uuid as for a missing one', async () => {
      const { id } = await harness.service.create(8, envelope());

      expect(await statusOf(harness.service.show(USER, id))).toEqual(await statusOf(harness.service.show(USER, MISSING_UUID)));
    });
  });

  describe('rename', () => {
    it('changes only the label, keeping the status', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.repo.rows[0].status = 'invalid';
      harness.repo.rows[0].statusReason = 'bad_credentials';
      const before = { ...harness.repo.rows[0] };

      const response = await harness.service.rename(USER, id, 'Personal');

      expect(response).toMatchObject({ label: 'Personal', status: 'invalid', statusReason: 'bad_credentials' });
      const after = harness.repo.rows[0];
      expect({ label: after.label, labelNormalized: after.labelNormalized })
        .toEqual({ label: 'Personal', labelNormalized: 'personal' });
      expect(after.updatedAt).toBeInstanceOf(Date);
      expect({ ...after, label: before.label, labelNormalized: before.labelNormalized, updatedAt: before.updatedAt })
        .toEqual(before);
    });

    it('allows renaming to the same label with a different case', async () => {
      const { id } = await harness.service.create(USER, envelope('Work'));

      expect((await harness.service.rename(USER, id, 'WORK')).label).toBe('WORK');
    });

    it('answers 409 for another row\'s label, case-insensitively', async () => {
      await harness.service.create(USER, envelope('Work'));
      const { id } = await harness.service.create(USER, envelope('Home'));

      const { status, body } = await statusOf(harness.service.rename(USER, id, 'wORK'));

      expect(status).toBe(409);
      expect(body).toMatchObject({ code: 'INTEGRATION_LABEL_TAKEN' });
    });

    it('answers 404 for a foreign uuid', async () => {
      const { id } = await harness.service.create(8, envelope());

      expect((await statusOf(harness.service.rename(USER, id, 'Mine'))).status).toBe(404);
      expect(harness.repo.rows[0].label).toBe('Work');
    });
  });

  describe('delete', () => {
    it('deletes the row after the no-op PAT cleanup, without a GitHub call', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.github.reset();

      await harness.service.delete(USER, id);

      expect(harness.repo.rows).toHaveLength(0);
      expect(harness.github.callCount).toBe(0);
    });

    it('deletes an undecryptable row', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.repo.rows[0].secretKeyId = 'deadbeef';

      await harness.service.delete(USER, id);

      expect(harness.repo.rows).toHaveLength(0);
    });

    it('never lets a failing cleanup block the deletion, logging safe fields only', async () => {
      const { id } = await harness.service.create(USER, envelope());
      harness.repo.rows[0].type = 'oauth_app';

      await harness.service.delete(USER, id);

      expect(harness.repo.rows).toHaveLength(0);
      expect(harness.logger.warn).toHaveBeenCalledWith('integration delete cleanup failed', {
        uuid: id,
        userId: USER,
        type: 'oauth_app',
        error: 'Error',
      });
    });

    it('logs a non-Error cleanup failure by its type', async () => {
      const { id } = await harness.service.create(USER, envelope());
      const strategy = (harness.service as unknown as { registry: { get: (type: string) => unknown } }).registry;
      jest.spyOn(strategy, 'get').mockReturnValue({
        parseSecretPayload: (secret: unknown) => secret,
        onDelete: () => Promise.reject('nope'),
      });

      await harness.service.delete(USER, id);

      expect(harness.logger.warn.mock.calls[0][1]).toMatchObject({ error: 'string' });
    });

    it('answers 404 for a foreign uuid and keeps the row', async () => {
      const { id } = await harness.service.create(8, envelope());

      expect((await statusOf(harness.service.delete(USER, id))).status).toBe(404);
      expect(harness.repo.rows).toHaveLength(1);
    });
  });

  describe('enabledTypes', () => {
    it('always lists pat', () => {
      expect(harness.service.enabledTypes()).toEqual([{ type: 'pat', flows: { credentialPaste: true, redirect: false } }]);
    });
  });
});
