import { renderToStaticMarkup } from 'react-dom/server';
import AuthorizationRequestsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx';

describe('AuthorizationRequestsHelper', () => {
  const buildHandlers = () => ({
    onToggleAuthorize: jasmine.createSpy('onToggleAuthorize').and.returnValue(jasmine.createSpy('handler')),
    onPasswordChange: jasmine.createSpy('onPasswordChange').and.returnValue(jasmine.createSpy('handler')),
    onConfirmAuthorize: jasmine.createSpy('onConfirmAuthorize').and.returnValue(jasmine.createSpy('handler')),
    onDeny: jasmine.createSpy('onDeny').and.returnValue(jasmine.createSpy('handler')),
  });
  const buildState = (overrides = {}) => ({
    requests: [],
    loadError: null,
    rowState: {},
    ...overrides,
  });

  describe('.render', () => {
    it('renders the page heading', () => {
      const html = renderToStaticMarkup(AuthorizationRequestsHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('Authorization Requests');
    });

    it('renders the load error alert when present', () => {
      const html = renderToStaticMarkup(
        AuthorizationRequestsHelper.render(buildState({ loadError: 'network error' }), buildHandlers()),
      );

      expect(html).toContain('network error');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no load error', () => {
      const html = renderToStaticMarkup(AuthorizationRequestsHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders an empty-state message when there are no requests', () => {
      const html = renderToStaticMarkup(AuthorizationRequestsHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('No pending authorization requests.');
    });

    describe('with open requests', () => {
      const requests = [{
        uuid: 'req-uuid',
        requestIp: '127.0.0.1',
        requestUserAgent: 'Mozilla/5.0',
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
      }];

      it('renders a row per request with its IP, User-Agent and age', () => {
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests }), buildHandlers()),
        );

        expect(html).toContain('127.0.0.1');
        expect(html).toContain('Mozilla/5.0');
        expect(html).toContain('5 min ago');
      });

      it('renders "just now" for a request under a minute old', () => {
        const freshRequests = [{ ...requests[0], createdAt: new Date().toISOString() }];
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests: freshRequests }), buildHandlers()),
        );

        expect(html).toContain('just now');
      });

      it('renders Deny and Authorize actions', () => {
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests }), buildHandlers()),
        );

        expect(html).toContain('Deny');
        expect(html).toContain('Authorize');
        expect(html).not.toContain('Confirm');
      });

      it('wires the deny and authorize-toggle handlers with the request uuid', () => {
        const handlers = buildHandlers();
        renderToStaticMarkup(AuthorizationRequestsHelper.render(buildState({ requests }), handlers));

        expect(handlers.onDeny).toHaveBeenCalledWith('req-uuid');
        expect(handlers.onToggleAuthorize).toHaveBeenCalledWith('req-uuid');
      });

      it('renders an inline password field and Confirm button once toggled open', () => {
        const rowState = { 'req-uuid': { open: true, password: '' } };
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests, rowState }), buildHandlers()),
        );

        expect(html).toContain('type="password"');
        expect(html).toContain('Confirm');
        expect(html).not.toContain('>Authorize<');
      });

      it('wires the password-change and confirm-authorize handlers with the request uuid', () => {
        const rowState = { 'req-uuid': { open: true, password: '' } };
        const handlers = buildHandlers();
        renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests, rowState }), handlers),
        );

        expect(handlers.onPasswordChange).toHaveBeenCalledWith('req-uuid');
        expect(handlers.onConfirmAuthorize).toHaveBeenCalledWith('req-uuid');
      });

      it('renders a row-level error message', () => {
        const rowState = { 'req-uuid': { error: 'Invalid password' } };
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests, rowState }), buildHandlers()),
        );

        expect(html).toContain('Invalid password');
      });

      it('renders nothing extra for a row with no recorded state', () => {
        const html = renderToStaticMarkup(
          AuthorizationRequestsHelper.render(buildState({ requests }), buildHandlers()),
        );

        expect(html).not.toContain('text-danger');
      });
    });
  });
});
