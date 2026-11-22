import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { githubRateLimited } from '../../core/github-http-errors.js';
import { issueLinkGone, issueNotLinked, projectHasNoRepository, projectNotFound, projectRepositoryUnavailable } from '../issues-http-errors.js';
import { call, expectNeverCached, useIssuesTestApp } from './support/build-issues-test-app.js';
import { sampleIssue } from './support/fake-issues.service.js';
import { ISSUE_ID, PROJECT_ID } from './support/registered-routes.js';

const BASE = `/projects/${PROJECT_ID}`;
const IMPORT = `${BASE}/issues/import.json`;
const REFRESH_ISSUE = `${BASE}/issues/${ISSUE_ID}/refresh.json`;
const REFRESH_PROJECT = `${BASE}/refresh.json`;
const RETRY_SYNC = `${BASE}/issues/${ISSUE_ID}/retry-sync.json`;

// The responses of the link and sync trigger routes; the access rules of every route are in the matrix.
describe('IssueLinksController responses (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  const post = (path: string, body: Record<string, unknown> = {}) => call(ctx.app, 'post', path, ctx.owner).send(body);

  it('passes a service HttpException through with its code and no-store headers', async () => {
    ctx.links.failWith('import', githubRateLimited(30));

    const response = await post(IMPORT, { number: 12 });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ErrorCodes.GITHUB_RATE_LIMITED);
    expectNeverCached(response);
  });

  it('answers a project that is not found with the plain 404', async () => {
    ctx.links.failWith('import', projectNotFound());

    expectErrorBody(await post(IMPORT, { number: 12 }), { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
  });

  it('T2 answers 202 { issue, alreadyFresh: false } when enqueued, and 200 { issue, alreadyFresh: true } when skipped', async () => {
    ctx.links.issue = sampleIssue();

    const enqueued = await post(REFRESH_ISSUE).expect(202);

    expect(enqueued.body).toEqual({ issue: ctx.links.issue, alreadyFresh: false });

    ctx.links.triggerStatus = 200;

    const skipped = await post(REFRESH_ISSUE).expect(200);

    expect(skipped.body).toEqual({ issue: ctx.links.issue, alreadyFresh: true });
    expect(ctx.links.callsOf('refreshIssue').map((entry) => entry.args)).toEqual([[PROJECT_ID, ISSUE_ID], [PROJECT_ID, ISSUE_ID]]);
  });

  it('T3 answers 202 { enqueued, skippedFresh }, with the project only', async () => {
    const response = await post(REFRESH_PROJECT).expect(202);

    expect(response.body).toEqual({ enqueued: 2, skippedFresh: 1 });
    expect(ctx.links.callsOf('refreshProject').map((entry) => entry.args)).toEqual([[PROJECT_ID]]);
  });

  it('T4 answers 202 { issue } when reset and enqueued, and 200 { issue } for a no-op', async () => {
    expect((await post(RETRY_SYNC).expect(202)).body).toEqual({ issue: ctx.links.issue });

    ctx.links.triggerStatus = 200;

    expect((await post(RETRY_SYNC).expect(200)).body).toEqual({ issue: ctx.links.issue });
  });

  it.each([
    ['refreshIssue', REFRESH_ISSUE, issueLinkGone()],
    ['retrySync', RETRY_SYNC, issueNotLinked()],
    ['refreshProject', REFRESH_PROJECT, projectHasNoRepository()],
    ['retrySync', RETRY_SYNC, projectRepositoryUnavailable()],
  ] as const)('passes the %s refusal through with its code and no-store headers', async (method, path, error) => {
    ctx.links.failWith(method, error);

    const response = await post(path);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe((error.getResponse() as { code: string }).code);
    expectNeverCached(response);
  });
});
