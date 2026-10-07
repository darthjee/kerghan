import SessionsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/SessionsHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('SessionsHelper', () => {
  const buildHandlers = () => ({
    onRevoke: jasmine.createSpy('onRevoke').and.returnValue(jasmine.createSpy('handler')),
    onRequestRevokeOthers: jasmine.createSpy('onRequestRevokeOthers'),
    onConfirmRevokeOthers: jasmine.createSpy('onConfirmRevokeOthers'),
    onCancelRevokeOthers: jasmine.createSpy('onCancelRevokeOthers'),
  });
  const buildState = (overrides = {}) => ({
    sessions: [],
    loadError: null,
    rowState: new Map(),
    pageState: { confirmingRevokeOthers: false, error: null },
    ...overrides,
  });
  const buildSession = (overrides = {}) => ({
    id: 'other-uuid',
    startedAt: '2026-10-01T10:00:00.000Z',
    lastUsedAt: '2026-10-02T11:00:00.000Z',
    keepSignedIn: false,
    current: false,
    ...overrides,
  });
  const currentSession = buildSession({ id: 'current-uuid', current: true });
  const otherSession = buildSession();

  const renderPage = (state, handlers = buildHandlers()) => renderedOutput(
    SessionsHelper.render(state, handlers),
  );

  describe('.render', () => {
    it('renders the page heading', () => {
      expect(renderPage(buildState()).containsElement('h1', 'Sessions')).toBeTrue();
    });

    it('renders the load error alert when present', () => {
      const page = renderPage(buildState({ loadError: 'network error' }));

      expect(page.contains('network error')).withContext('error message').toBeTrue();
      expect(page.contains('alert-danger')).withContext('alert class').toBeTrue();
    });

    it('renders no alert when there is no load error', () => {
      expect(renderPage(buildState()).contains('alert-danger')).toBeFalse();
    });

    it('renders an empty-state message when there are no sessions', () => {
      expect(renderPage(buildState()).contains('No active sessions.')).toBeTrue();
    });

    describe('with sessions', () => {
      it('renders a row per session with absolute start and last-used date-times', () => {
        const page = renderPage(buildState({ sessions: [otherSession] }));

        expect(page.contains(new Date(otherSession.startedAt).toLocaleString()))
          .withContext('started').toBeTrue();
        expect(page.contains(new Date(otherSession.lastUsedAt).toLocaleString()))
          .withContext('last used').toBeTrue();
        expect(page.containsElement('th', 'Last used')).withContext('column').toBeTrue();
      });

      it('renders the current-session badge only on the current session', () => {
        expect(renderPage(buildState({ sessions: [currentSession] }))
          .containsElement('span', 'Current session')).toBeTrue();
        expect(renderPage(buildState({ sessions: [otherSession] }))
          .contains('Current session')).toBeFalse();
      });

      it('renders the keep-signed-in badge only when keepSignedIn is true', () => {
        expect(renderPage(buildState({ sessions: [buildSession({ keepSignedIn: true })] }))
          .containsElement('span', 'Keep signed in')).toBeTrue();
        expect(renderPage(buildState({ sessions: [otherSession] }))
          .contains('Keep signed in')).toBeFalse();
      });

      it('renders a Revoke button wired with the session id for a non-current session', () => {
        const handlers = buildHandlers();
        const page = renderPage(buildState({ sessions: [otherSession] }), handlers);

        expect(page.containsElement('button', 'Revoke')).toBeTrue();
        expect(handlers.onRevoke).toHaveBeenCalledWith('other-uuid');
      });

      it('does not render a Revoke button on the current session', () => {
        const handlers = buildHandlers();
        const page = renderPage(buildState({ sessions: [currentSession] }), handlers);

        expect(page.contains('Revoke')).toBeFalse();
        expect(handlers.onRevoke).not.toHaveBeenCalled();
      });

      it('renders a row-level error message', () => {
        const rowState = new Map([['other-uuid', { error: 'Session not found' }]]);
        const page = renderPage(buildState({ sessions: [otherSession], rowState }));

        expect(page.contains('Session not found')).toBeTrue();
      });

      it('renders no error for a row with no recorded state', () => {
        expect(renderPage(buildState({ sessions: [otherSession] })).contains('text-danger'))
          .toBeFalse();
      });
    });

    describe('sign out all other sessions', () => {
      it('is hidden when no session is current', () => {
        const page = renderPage(buildState({ sessions: [otherSession] }));

        expect(page.contains('Sign out all other sessions')).toBeFalse();
      });

      it('is hidden when the current session is the only one', () => {
        const page = renderPage(buildState({ sessions: [currentSession] }));

        expect(page.contains('Sign out all other sessions')).toBeFalse();
      });

      it('renders the request button when closed', () => {
        const page = renderPage(buildState({ sessions: [currentSession, otherSession] }));

        expect(page.containsElement('button', 'Sign out all other sessions'))
          .withContext('request button').toBeTrue();
        expect(page.contains('Confirm')).withContext('confirm button').toBeFalse();
      });

      it('renders the confirmation prompt when confirming', () => {
        const page = renderPage(buildState({
          sessions: [currentSession, otherSession],
          pageState: { confirmingRevokeOthers: true, error: null },
        }));

        expect(page.contains('Sign out every session except this one?'))
          .withContext('prompt').toBeTrue();
        expect(page.containsElement('button', 'Confirm')).withContext('confirm').toBeTrue();
        expect(page.containsElement('button', 'Cancel')).withContext('cancel').toBeTrue();
        expect(page.containsElement('button', 'Sign out all other sessions'))
          .withContext('request button').toBeFalse();
      });

      it('renders the page-level error', () => {
        const page = renderPage(buildState({
          sessions: [currentSession, otherSession],
          pageState: { confirmingRevokeOthers: false, error: 'Server error' },
        }));

        expect(page.contains('Server error')).toBeTrue();
      });
    });
  });
});
