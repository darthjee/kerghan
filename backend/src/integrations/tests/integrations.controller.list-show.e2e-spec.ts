import { call, createIntegration, expectSafeBody, useIntegrationsTestApp } from './support/build-integrations-test-app.js';

describe('IntegrationsController list, show and types (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();

  it('lists only the caller\'s integrations, newest first', async () => {
    await createIntegration(ctx, ctx.owner, { label: 'Older' });
    await createIntegration(ctx, ctx.owner, { label: 'Newer' });
    await createIntegration(ctx, ctx.intruder, { label: 'Foreign' });
    ctx.repo.rows[0].createdAt = new Date('2026-01-01T00:00:00Z');
    ctx.repo.rows[1].createdAt = new Date('2026-02-01T00:00:00Z');

    const response = await call(ctx.app, 'post', '/integrations/mine.json', ctx.owner).expect(200);

    expect(response.body.integrations.map((integration: { label: string }) => integration.label))
      .toEqual(['Newer', 'Older']);
    expectSafeBody(response.body);
  });

  it('answers an empty list for a user without integrations', async () => {
    const response = await call(ctx.app, 'post', '/integrations/mine.json', ctx.owner).expect(200);

    expect(response.body).toEqual({ integrations: [] });
  });

  it('shows one integration', async () => {
    const { body: created } = await createIntegration(ctx, ctx.owner);

    const response = await call(ctx.app, 'post', `/integrations/${created.id}/show.json`, ctx.owner).expect(200);

    expect(response.body).toEqual(created);
    expectSafeBody(response.body);
  });

  it('reports an active row past expiresAt as expired, on list and show', async () => {
    const { body: created } = await createIntegration(ctx, ctx.owner);
    ctx.repo.rows[0].expiresAt = new Date('2000-01-01T00:00:00Z');

    const list = await call(ctx.app, 'post', '/integrations/mine.json', ctx.owner).expect(200);
    const show = await call(ctx.app, 'post', `/integrations/${created.id}/show.json`, ctx.owner).expect(200);

    expect(list.body.integrations[0].status).toBe('expired');
    expect(show.body).toMatchObject({ status: 'expired', expiresAt: '2000-01-01T00:00:00.000Z' });
    expect(ctx.repo.rows[0].status).toBe('active');
  });

  it('lists undecryptable rows with a null hint', async () => {
    const { body: created } = await createIntegration(ctx, ctx.owner);
    ctx.repo.rows[0].secretKeyId = 'deadbeef';

    const list = await call(ctx.app, 'post', '/integrations/mine.json', ctx.owner).expect(200);
    const show = await call(ctx.app, 'post', `/integrations/${created.id}/show.json`, ctx.owner).expect(200);

    expect(list.body.integrations[0]).toMatchObject({ status: 'undecryptable', secretHint: null });
    expect(show.body).toMatchObject({ status: 'undecryptable', secretHint: null });
  });

  it('lists the enabled types, pat always included', async () => {
    const response = await call(ctx.app, 'post', '/integrations/types.json', ctx.owner).expect(200);

    expect(response.body).toEqual({ types: [{ type: 'pat', flows: { credentialPaste: true, redirect: false } }] });
  });
});
