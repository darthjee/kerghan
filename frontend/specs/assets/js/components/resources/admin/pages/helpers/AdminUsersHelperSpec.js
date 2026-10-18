import AdminUsersHelper from '../../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('AdminUsersHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onQueryChange: jasmine.createSpy('onQueryChange'),
    onGenerateLink: jasmine.createSpy('onGenerateLink').and.returnValue(jasmine.createSpy('handler')),
    onSendEmail: jasmine.createSpy('onSendEmail').and.returnValue(jasmine.createSpy('handler')),
    onStatusChange: jasmine.createSpy('onStatusChange'),
    onApprove: jasmine.createSpy('onApprove').and.returnValue(jasmine.createSpy('handler')),
    onDeny: jasmine.createSpy('onDeny').and.returnValue(jasmine.createSpy('handler')),
  });
  const buildState = (overrides = {}) => ({
    query: '',
    status: '',
    users: [],
    rowResults: {},
    searchError: null,
    currentUserId: null,
    ...overrides,
  });

  const renderPage = (state, handlers = buildHandlers()) => renderedOutput(
    AdminUsersHelper.render(state, handlers),
  );

  describe('.render', () => {
    it('renders the search input', () => {
      const page = renderPage(buildState());

      expect(page.contains('Search by username or email')).toBeTrue();
    });

    it('renders the status filter with every option', () => {
      const page = renderPage(buildState());

      expect(page.containsTag('select')).withContext('select').toBeTrue();
      expect(page.containsInOrder('>All<', '>Pending<', '>Approved<', '>Denied<'))
        .withContext('options').toBeTrue();
    });

    it('selects the current status filter', () => {
      const page = renderPage(buildState({ status: 'pending' }));

      expect(page.contains('<option value="pending" selected="">')).toBeTrue();
    });

    it('renders the search error alert when present', () => {
      const page = renderPage(buildState({ searchError: 'network error' }));

      expect(page.contains('network error')).withContext('error message').toBeTrue();
      expect(page.contains('alert-danger')).withContext('alert class').toBeTrue();
    });

    it('renders no alert when there is no search error', () => {
      const page = renderPage(buildState());

      expect(page.contains('alert-danger')).toBeFalse();
    });

    it('renders a "no users found" message when there are no results', () => {
      const page = renderPage(buildState());

      expect(page.contains('No users found.')).toBeTrue();
    });

    describe('with search results', () => {
      const users = [{
        id: 1, username: 'foo', email: 'foo@example.com', isAdmin: true, createdAt: '2026-01-01',
        status: 'pending',
      }];

      it('renders the status column', () => {
        const page = renderPage(buildState({ users }));

        expect(page.containsElement('th', 'Status')).withContext('header').toBeTrue();
        expect(page.containsElement('td', 'pending')).withContext('cell').toBeTrue();
      });

      it('renders Approve and Deny for a pending user', () => {
        const handlers = buildHandlers();
        const page = renderPage(buildState({ users, currentUserId: 99 }), handlers);

        expect(page.containsElement('button', 'Approve')).withContext('Approve').toBeTrue();
        expect(page.containsElement('button', 'Deny')).withContext('Deny').toBeTrue();
        expect(handlers.onApprove).toHaveBeenCalledWith(1);
        expect(handlers.onDeny).toHaveBeenCalledWith(1);
      });

      it('renders Deny but not Approve for an approved user', () => {
        const page = renderPage(buildState({ users: [{ ...users[0], status: 'approved' }] }));

        expect(page.containsElement('button', 'Approve')).withContext('Approve').toBeFalse();
        expect(page.containsElement('button', 'Deny')).withContext('Deny').toBeTrue();
      });

      it('renders no review action for a denied user', () => {
        const page = renderPage(buildState({ users: [{ ...users[0], status: 'denied' }] }));

        expect(page.containsElement('button', 'Approve')).withContext('Approve').toBeFalse();
        expect(page.containsElement('button', 'Deny')).withContext('Deny').toBeFalse();
      });

      it('hides Deny on the calling admin\'s own row', () => {
        const page = renderPage(buildState({
          users: [{ ...users[0], status: 'approved' }], currentUserId: 1,
        }));

        expect(page.containsElement('button', 'Deny')).toBeFalse();
      });

      it('renders a 409 / 422 review error message against the row', () => {
        const page = renderPage(buildState({
          users, rowResults: { 1: { error: 'The default user is managed by configuration' } },
        }));

        expect(page.contains('The default user is managed by configuration')).toBeTrue();
      });

      it('renders a row per user', () => {
        const page = renderPage(buildState({ users }));

        expect(page.contains('foo')).withContext('username').toBeTrue();
        expect(page.contains('foo@example.com')).withContext('email').toBeTrue();
      });

      it('renders the admin flag as Yes/No', () => {
        const page = renderPage(buildState({ users }));

        expect(page.contains('Yes')).toBeTrue();
      });

      it('renders Generate link and Send email actions', () => {
        const page = renderPage(buildState({ users }));

        expect(page.contains('Generate link')).withContext('Generate link action').toBeTrue();
        expect(page.contains('Send email')).withContext('Send email action').toBeTrue();
      });

      it('renders an Edit link pointing at the user\'s edit route', () => {
        const page = renderPage(buildState({ users }));

        expect(page.containsAttribute('href', '#/admin/users/1/edit')).withContext('edit href').toBeTrue();
        expect(page.containsElement('a', 'Edit')).withContext('Edit link text').toBeTrue();
      });

      it('renders a copyable recovery link when one has been generated', () => {
        const page = renderPage(
          buildState({ users, rowResults: { 1: { resetUrl: 'https://example.com/reset?token=abc' } } }),
        );

        expect(page.contains('https://example.com/reset?token=abc')).toBeTrue();
      });

      it('renders a success message once the recovery email has been sent', () => {
        const page = renderPage(buildState({ users, rowResults: { 1: { sent: true } } }));

        expect(page.contains('Email sent')).toBeTrue();
      });

      it('renders a failure message when the recovery email failed to send', () => {
        const page = renderPage(buildState({ users, rowResults: { 1: { sent: false } } }));

        expect(page.contains('Email failed to send')).toBeTrue();
      });

      it('renders a row-level error message', () => {
        const page = renderPage(buildState({ users, rowResults: { 1: { error: 'not found' } } }));

        expect(page.contains('not found')).toBeTrue();
      });

      it('renders nothing extra for a row with no recorded result', () => {
        const page = renderPage(buildState({ users }));

        expect(page.contains('Email sent')).withContext('success message').toBeFalse();
        expect(page.contains('Email failed to send')).withContext('failure message').toBeFalse();
      });
    });
  });
});
