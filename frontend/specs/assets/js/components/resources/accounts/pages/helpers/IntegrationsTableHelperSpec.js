import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationsTableHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationsTableHelper.jsx';
import OauthAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';
import { taggedHandlers } from '../../../../../../../support/taggedHandlers.js';

describe('IntegrationsTableHelper', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  const DAY = 24 * 60 * 60 * 1000;
  const base = {
    id: 'abc',
    type: 'pat',
    label: 'Work',
    status: 'active',
    statusReason: null,
    secretHint: 'ghp_…a1b2',
    githubLogin: 'octocat',
    expiresAt: null,
    lastTestedAt: null,
    lastTestResult: null,
    nextTestAt: null,
  };
  const markupOf = (integrations) => renderToStaticMarkup(IntegrationsTableHelper.render(
    { integrations, rowState: new Map() }, taggedHandlers(),
  ));
  const markupFor = (overrides) => markupOf([{ ...base, ...overrides }]);

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('renders the column headers', () => {
    const markup = markupFor({});

    ['Label', 'Type', 'GitHub account', 'Status', 'Credential', 'Expiry', 'Last tested', 'Actions']
      .forEach((header) => expect(markup).toContain(`<th>${header}</th>`));
  });

  it('renders the label, type name, login and secret hint', () => {
    const markup = markupFor({});

    expect(markup).toContain('Work');
    expect(markup).toContain('Personal Access Token');
    expect(markup).toContain('octocat');
    expect(markup).toContain('ghp_…a1b2');
  });

  it('renders "unavailable" without a secret hint', () => {
    expect(markupFor({ status: 'undecryptable', secretHint: null })).toContain('<td>unavailable</td>');
  });

  describe('status', () => {
    it('renders an active badge', () => {
      expect(markupFor({})).toContain('text-bg-success">active</span>');
    });

    it('renders invalid with its reason text', () => {
      const markup = markupFor({ status: 'invalid', statusReason: 'bad_credentials' });

      expect(markup).toContain('text-bg-danger">invalid</span>');
      expect(markup).toContain('GitHub rejected this token.');
    });

    it('renders invalid without a reason', () => {
      expect(markupFor({ status: 'invalid' })).toContain('text-bg-danger">invalid</span>');
    });

    it('renders an expired badge', () => {
      expect(markupFor({ status: 'expired', expiresAt: new Date(NOW - DAY).toISOString() }))
        .toContain('text-bg-warning">expired</span>');
    });

    it('explains undecryptable', () => {
      const markup = markupFor({ status: 'undecryptable', secretHint: null });

      expect(markup).toContain('text-bg-secondary">undecryptable</span>');
      expect(markup).toContain('can&#x27;t currently be read');
    });

    it('renders an unknown status with a neutral badge', () => {
      expect(markupFor({ status: 'mystery' })).toContain('text-bg-light">mystery</span>');
    });
  });

  describe('expiry', () => {
    it('renders "no expiry"', () => {
      expect(markupFor({})).toContain('no expiry');
    });

    it('flags an expiry within 7 days', () => {
      const markup = markupFor({ expiresAt: new Date(NOW + 3 * DAY).toISOString() });

      expect(markup).toContain('2026-10-04');
      expect(markup).toContain('Expiring soon');
    });

    it('does not flag an expiry beyond 7 days', () => {
      const markup = markupFor({ expiresAt: new Date(NOW + 30 * DAY).toISOString() });

      expect(markup).toContain('2026-10-31');
      expect(markup).not.toContain('Expiring soon');
    });

    it('does not flag an expired integration', () => {
      expect(markupFor({ status: 'expired', expiresAt: new Date(NOW - DAY).toISOString() }))
        .not.toContain('Expiring soon');
    });
  });

  describe('last tested', () => {
    it('renders "never"', () => {
      expect(markupFor({})).toContain('<td>never</td>');
    });

    it('renders the relative time and result', () => {
      const markup = markupFor({
        lastTestedAt: new Date(NOW - 5 * 60 * 1000).toISOString(), lastTestResult: 'transient_error',
      });

      expect(markup).toContain('5 minutes ago (transient error)');
    });

    it('renders an unknown result as is', () => {
      const markup = markupFor({ lastTestedAt: new Date(NOW).toISOString(), lastTestResult: 'other' });

      expect(markup).toContain('just now (other)');
    });
  });

  describe('shared-login hint', () => {
    it('is shown when two integrations share the login', () => {
      const markup = markupOf([base, { ...base, id: 'def', label: 'Other' }]);

      expect(markup).toContain('Another integration uses this GitHub account.');
    });

    it('is hidden for distinct logins', () => {
      const markup = markupOf([base, { ...base, id: 'def', githubLogin: 'hubot' }]);

      expect(markup).not.toContain('Another integration uses this GitHub account.');
    });
  });

  it('renders the actions with the row state', () => {
    const markup = renderToStaticMarkup(IntegrationsTableHelper.render(
      { integrations: [base], rowState: new Map([['abc', { error: 'Row failed' }]]) },
      taggedHandlers(),
    ));

    expect(markup).toContain('Row failed');
    expect(markup).toContain('>Test</button>');
  });

  describe('oauth_app rows', () => {
    const oauthRow = {
      ...base, type: 'oauth_app', secretHint: 'gho_…a1b2', expiresAt: null,
    };
    const markupWithTypes = (types) => renderToStaticMarkup(IntegrationsTableHelper.render(
      { integrations: [oauthRow], rowState: new Map(), types }, taggedHandlers(),
    ));

    it('shows the gho_ hint and no expiry', () => {
      const markup = markupWithTypes([OauthAppType]);

      expect(markup).toContain('gho_…a1b2');
      expect(markup).toContain('no expiry');
    });

    it('passes the enabled types to the actions', () => {
      expect(markupWithTypes([OauthAppType])).toContain('Reconnect with GitHub');
      expect(markupWithTypes([])).toContain('The OAuth App is disabled on this server.');
    });

    it('explains the revoked reason', () => {
      const markup = renderToStaticMarkup(IntegrationsTableHelper.render(
        {
          integrations: [{ ...oauthRow, status: 'invalid', statusReason: 'revoked' }],
          rowState: new Map(),
          types: [OauthAppType],
        },
        taggedHandlers(),
      ));

      expect(markup).toContain('GitHub no longer accepts this authorization.');
    });
  });
});
