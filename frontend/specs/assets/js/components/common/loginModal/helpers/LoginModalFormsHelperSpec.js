import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginModalFormsHelper from '../../../../../../../assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx';

describe('LoginModalFormsHelper', () => {
  const buildHandlers = () => ({
    onSelectMode: jasmine.createSpy('onSelectMode'),
    onSubmit: jasmine.createSpy('onSubmit'),
    onUsernameChange: jasmine.createSpy('onUsernameChange'),
    onEmailChange: jasmine.createSpy('onEmailChange'),
    onPasswordChange: jasmine.createSpy('onPasswordChange'),
    onPasswordConfirmationChange: jasmine.createSpy('onPasswordConfirmationChange'),
  });

  const buildState = (overrides = {}) => ({
    mode: 'password',
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    fieldErrors: {},
    submitError: null,
    resultPanel: null,
    deviceExpiresAt: null,
    now: undefined,
    ...overrides,
  });

  const markup = (state, handlers = buildHandlers()) => renderToStaticMarkup(
    React.createElement('div', null, LoginModalFormsHelper.render(state, handlers)),
  );

  describe('.render', () => {
    it('renders a selector button for each mode', () => {
      const html = markup(buildState());

      expect(html).toContain('>Password</button>');
      expect(html).toContain('>Register</button>');
      expect(html).toContain('>Recover</button>');
      expect(html).toContain('>Authorize with logged device</button>');
    });

    it('renders a lone username field with the Send request label in device mode', () => {
      const html = markup(buildState({ mode: 'device' }));

      expect(html).toContain('id="login-modal-username"');
      expect(html).not.toContain('id="login-modal-password"');
      expect(html).not.toContain('id="login-modal-email"');
      expect(html).toContain('>Send request</button>');
    });

    it('invokes onSelectMode with device when the fourth selector button is clicked', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(buildState(), handlers);
      const [selector] = tree.props.children;
      const deviceButton = selector.props.children.find((button) => button.key === 'device');

      deviceButton.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('device');
    });

    it('marks the active mode button', () => {
      const html = markup(buildState({ mode: 'register' }));

      expect(html).toContain('btn btn-outline-primary active');
    });

    it('renders only the username and password fields in password mode', () => {
      const html = markup(buildState());

      expect(html).toContain('id="login-modal-username"');
      expect(html).toContain('id="login-modal-password"');
      expect(html).not.toContain('id="login-modal-email"');
      expect(html).not.toContain('id="login-modal-passwordConfirmation"');
    });

    it('renders the full field set in register mode', () => {
      const html = markup(buildState({ mode: 'register' }));

      expect(html).toContain('id="login-modal-email"');
      expect(html).toContain('id="login-modal-passwordConfirmation"');
    });

    it('renders only the email field in recover mode', () => {
      const html = markup(buildState({ mode: 'recover' }));

      expect(html).toContain('id="login-modal-email"');
      expect(html).not.toContain('id="login-modal-username"');
      expect(html).not.toContain('id="login-modal-password"');
    });

    it('renders the two password fields in resetPassword mode', () => {
      const html = markup(buildState({ mode: 'resetPassword' }));

      expect(html).toContain('id="login-modal-password"');
      expect(html).toContain('id="login-modal-passwordConfirmation"');
      expect(html).not.toContain('id="login-modal-username"');
      expect(html).not.toContain('id="login-modal-email"');
    });

    it('falls back to the password field set for an unknown mode', () => {
      const html = markup(buildState({ mode: 'mystery' }));

      expect(html).toContain('id="login-modal-username"');
      expect(html).toContain('id="login-modal-password"');
      expect(html).not.toContain('id="login-modal-email"');
    });

    it('labels the submit button per mode', () => {
      expect(markup(buildState())).toContain('>Log in</button>');
      expect(markup(buildState({ mode: 'register' }))).toContain('>Register</button>');
    });

    it('renders the submit error alert when present', () => {
      const html = markup(buildState({ submitError: 'invalid credentials' }));

      expect(html).toContain('invalid credentials');
      expect(html).toContain('alert-danger');
    });

    it('renders no alert when there is no submit error', () => {
      expect(markup(buildState())).not.toContain('alert-danger');
    });

    it('renders an inline field error and the is-invalid class in register mode', () => {
      const html = markup(buildState({
        mode: 'register',
        fieldErrors: { email: 'Email is invalid' },
      }));

      expect(html).toContain('Email is invalid');
      expect(html).toContain('is-invalid');
    });

    it('invokes onSelectMode with the clicked mode', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(buildState(), handlers);
      const [selector] = tree.props.children;
      const registerButton = selector.props.children.find(
        (button) => button.key === 'register',
      );

      registerButton.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('register');
    });
  });

  describe('.render result panels', () => {
    it('renders the neutral recover panel and no form or selector', () => {
      const html = markup(buildState({ resultPanel: 'recover' }));

      expect(html).toContain('If that email matches an account, a reset link is on its way.');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('btn-outline-primary');
    });

    it('renders the reset-password success panel with a back-to-log-in button', () => {
      const html = markup(buildState({ resultPanel: 'resetPassword' }));

      expect(html).toContain('Your password has been updated.');
      expect(html).toContain('>Back to log in</button>');
      expect(html).not.toContain('<form');
    });

    it('routes the back-to-log-in button click through onSelectMode', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(
        buildState({ resultPanel: 'resetPassword' }), handlers,
      );
      const [, button] = tree.props.children.props.children;

      button.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('password');
    });
  });

  describe('.render device panels', () => {
    const waitingState = buildState({
      resultPanel: 'device:waiting',
      deviceExpiresAt: '2026-01-01T00:05:00.000Z',
      now: Date.parse('2026-01-01T00:00:00.000Z'),
    });

    it('renders the waiting panel with a spinner and an mm:ss countdown, no retry', () => {
      const html = markup(waitingState);

      expect(html).toContain('Waiting for another device to approve');
      expect(html).toContain('spinner-border');
      expect(html).toContain('05:00');
      expect(html).not.toContain('>Try again</button>');
      expect(html).not.toContain('<form');
    });

    it('clamps the countdown at 00:00 once the expiry has passed', () => {
      const html = markup(buildState({
        resultPanel: 'device:waiting',
        deviceExpiresAt: '2026-01-01T00:00:00.000Z',
        now: Date.parse('2026-01-01T00:05:00.000Z'),
      }));

      expect(html).toContain('00:00');
    });

    [
      ['device:denied', 'The request was denied on the other device.'],
      ['device:expired', 'The request expired before it was approved.'],
      ['device:logged', 'This login was already completed on another device.'],
      ['device:notFound', 'That request could not be found.'],
    ].forEach(([panel, copy]) => {
      it(`renders the ${panel} copy with a retry button`, () => {
        const html = markup(buildState({ resultPanel: panel }));

        expect(html).toContain(copy);
        expect(html).toContain('>Try again</button>');
        expect(html).not.toContain('<form');
      });

      it(`routes the ${panel} retry button through onSelectMode('device')`, () => {
        const handlers = buildHandlers();
        const tree = LoginModalFormsHelper.render(buildState({ resultPanel: panel }), handlers);
        const [, button] = tree.props.children.props.children;

        button.props.onClick();

        expect(handlers.onSelectMode).toHaveBeenCalledWith('device');
      });
    });
  });
});
