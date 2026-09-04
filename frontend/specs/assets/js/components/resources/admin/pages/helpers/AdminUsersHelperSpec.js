import { renderToStaticMarkup } from 'react-dom/server';
import AdminUsersHelper from '../../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx';

describe('AdminUsersHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onQueryChange: jasmine.createSpy('onQueryChange'),
    onGenerateLink: jasmine.createSpy('onGenerateLink').and.returnValue(jasmine.createSpy('handler')),
    onSendEmail: jasmine.createSpy('onSendEmail').and.returnValue(jasmine.createSpy('handler')),
  });
  const buildState = (overrides = {}) => ({
    query: '',
    users: [],
    rowResults: {},
    searchError: null,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the search input', () => {
      const html = renderToStaticMarkup(AdminUsersHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('Search by username or email');
    });

    it('renders the search error alert when present', () => {
      const html = renderToStaticMarkup(
        AdminUsersHelper.render(buildState({ searchError: 'network error' }), buildHandlers()),
      );

      expect(html).toContain('network error');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no search error', () => {
      const html = renderToStaticMarkup(AdminUsersHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders a "no users found" message when there are no results', () => {
      const html = renderToStaticMarkup(AdminUsersHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('No users found.');
    });

    describe('with search results', () => {
      const users = [{
        id: 1, username: 'foo', email: 'foo@example.com', isAdmin: true, createdAt: '2026-01-01',
      }];

      it('renders a row per user', () => {
        const html = renderToStaticMarkup(AdminUsersHelper.render(buildState({ users }), buildHandlers()));

        expect(html).toContain('foo');
        expect(html).toContain('foo@example.com');
      });

      it('renders the admin flag as Yes/No', () => {
        const html = renderToStaticMarkup(AdminUsersHelper.render(buildState({ users }), buildHandlers()));

        expect(html).toContain('Yes');
      });

      it('renders Generate link and Send email actions', () => {
        const html = renderToStaticMarkup(AdminUsersHelper.render(buildState({ users }), buildHandlers()));

        expect(html).toContain('Generate link');
        expect(html).toContain('Send email');
      });

      it('renders a copyable recovery link when one has been generated', () => {
        const html = renderToStaticMarkup(
          AdminUsersHelper.render(
            buildState({ users, rowResults: { 1: { resetUrl: 'https://example.com/reset?token=abc' } } }),
            buildHandlers(),
          ),
        );

        expect(html).toContain('https://example.com/reset?token=abc');
      });

      it('renders a success message once the recovery email has been sent', () => {
        const html = renderToStaticMarkup(
          AdminUsersHelper.render(
            buildState({ users, rowResults: { 1: { sent: true } } }),
            buildHandlers(),
          ),
        );

        expect(html).toContain('Email sent');
      });

      it('renders a failure message when the recovery email failed to send', () => {
        const html = renderToStaticMarkup(
          AdminUsersHelper.render(
            buildState({ users, rowResults: { 1: { sent: false } } }),
            buildHandlers(),
          ),
        );

        expect(html).toContain('Email failed to send');
      });

      it('renders a row-level error message', () => {
        const html = renderToStaticMarkup(
          AdminUsersHelper.render(
            buildState({ users, rowResults: { 1: { error: 'not found' } } }),
            buildHandlers(),
          ),
        );

        expect(html).toContain('not found');
      });

      it('renders nothing extra for a row with no recorded result', () => {
        const html = renderToStaticMarkup(AdminUsersHelper.render(buildState({ users }), buildHandlers()));

        expect(html).not.toContain('Email sent');
        expect(html).not.toContain('Email failed to send');
      });
    });
  });
});
