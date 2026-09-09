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
});
