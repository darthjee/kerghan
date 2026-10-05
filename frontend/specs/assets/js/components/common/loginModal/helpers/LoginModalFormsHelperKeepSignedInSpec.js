import React from 'react';
import LoginModalFormsHelper from '../../../../../../../assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('LoginModalFormsHelper keep-signed-in checkbox', () => {
  const buildHandlers = () => ({
    onSelectMode: jasmine.createSpy('onSelectMode'),
    onSubmit: jasmine.createSpy('onSubmit'),
    onKeepSignedInChange: jasmine.createSpy('onKeepSignedInChange'),
  });

  const buildState = (overrides = {}) => ({
    mode: 'password',
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    keepSignedIn: false,
    fieldErrors: {},
    submitError: null,
    resultPanel: null,
    ...overrides,
  });

  const renderForms = (state) => renderedOutput(
    React.createElement('div', null, LoginModalFormsHelper.render(state, buildHandlers())),
  );

  ['password', 'device'].forEach((mode) => {
    it(`renders the checkbox in ${mode} mode`, () => {
      const forms = renderForms(buildState({ mode }));

      expect(forms.contains('id="login-modal-keepSignedIn"')).withContext('checkbox').toBeTrue();
      expect(forms.containsElement('label', 'Keep me signed in')).withContext('label').toBeTrue();
    });
  });

  ['register', 'recover', 'resetPassword'].forEach((mode) => {
    it(`does not render the checkbox in ${mode} mode`, () => {
      const forms = renderForms(buildState({ mode }));

      expect(forms.contains('login-modal-keepSignedIn')).toBeFalse();
      expect(forms.contains('Keep me signed in')).toBeFalse();
    });
  });

  it('does not render the checkbox while a result panel is shown', () => {
    const forms = renderForms(buildState({
      mode: 'device', resultPanel: 'device:waiting', deviceExpiresAt: null,
    }));

    expect(forms.contains('Keep me signed in')).toBeFalse();
  });

  it('is unchecked when keepSignedIn is falsy', () => {
    const forms = renderForms(buildState({ keepSignedIn: undefined }));

    expect(forms.contains('checked=""')).toBeFalse();
  });

  it('is checked when keepSignedIn is true', () => {
    const forms = renderForms(buildState({ keepSignedIn: true }));

    expect(forms.contains('checked=""')).toBeTrue();
  });

  it('wires the checkbox to onKeepSignedInChange', () => {
    const handlers = buildHandlers();
    const tree = LoginModalFormsHelper.render(buildState(), handlers);
    const [, form] = tree.props.children;
    const checkbox = form.props.children
      .find((child) => child?.props?.className === 'form-check mb-3');
    const [input] = checkbox.props.children;

    expect(input.props.onChange).toBe(handlers.onKeepSignedInChange);
  });
});
