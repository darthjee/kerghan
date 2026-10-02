import type { Integration } from '../entities/integration.entity.js';
import { toIntegrationResponse } from '../integration-response.js';

const NOW = new Date('2026-10-01T12:00:00.000Z');

function row(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 1,
    uuid: '11111111-1111-4111-8111-111111111111',
    userId: 7,
    provider: 'github',
    type: 'pat',
    label: 'Work',
    status: 'active',
    statusReason: null,
    secretHint: 'ghp_…a1b2',
    githubLogin: 'octocat',
    metadata: {},
    expiresAt: null,
    lastTestedAt: null,
    lastTestResult: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Integration;
}

describe('toIntegrationResponse', () => {
  it('answers a null nextTestAt when none is given', () => {
    expect(toIntegrationResponse(row(), true, null, NOW).nextTestAt).toBeNull();
  });

  it('formats nextTestAt as ISO-8601', () => {
    const response = toIntegrationResponse(
      row({ lastTestedAt: NOW }),
      true,
      new Date('2026-10-01T12:00:30.000Z'),
      NOW,
    );

    expect(response).toMatchObject({
      lastTestedAt: '2026-10-01T12:00:00.000Z',
      nextTestAt: '2026-10-01T12:00:30.000Z',
    });
  });

  it('keeps nextTestAt even when it lies in the past', () => {
    const response = toIntegrationResponse(row(), true, new Date('2020-01-01T00:00:30.000Z'), NOW);

    expect(response.nextTestAt).toBe('2020-01-01T00:00:30.000Z');
  });

  it('defaults now to the current time', () => {
    expect(toIntegrationResponse(row(), true, null).status).toBe('active');
  });
});
