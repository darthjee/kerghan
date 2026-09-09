import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHelper from '../../../../../assets/js/components/helpers/AppHelper.jsx';
import LoginModal from '../../../../../assets/js/components/common/loginModal/LoginModal.jsx';
import ModalRedirect from '../../../../../assets/js/components/common/ModalRedirect.jsx';

describe('AppHelper', () => {
  const markupFor = (page) => renderToStaticMarkup(
    React.createElement('div', null, AppHelper.render(page)),
  );

  const partsOf = (page) => {
    const [header, loginModal] = AppHelper.render(page).props.children;
    return { page: header.props.children, loginModal };
  };

  it('redirects the register key into the register-mode modal', () => {
    const { page } = partsOf('register');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('register');
  });

  it('redirects the login key into the password-mode modal', () => {
    const { page } = partsOf('login');

    expect(page.type).toBe(ModalRedirect);
    expect(page.props.mode).toBe('password');
  });

  it('mounts the login modal alongside the header, route-independent', () => {
    expect(partsOf('home').loginModal.type).toBe(LoginModal);
    expect(partsOf('recover').loginModal.type).toBe(LoginModal);
  });

  it('renders the recover page for the recover key', () => {
    expect(markupFor('recover')).toContain('Recover');
  });

  it('renders the reset-password page for the reset-password key', () => {
    expect(markupFor('reset-password')).toContain('Reset');
  });

  it('renders the admin users page for the admin-users key', () => {
    expect(markupFor('admin-users')).toContain('Admin Users');
  });

  it('renders the home page for the home key', () => {
    expect(markupFor('home')).toContain('Kerghan');
  });

  it('falls back to the home page for an unknown key', () => {
    expect(markupFor('unknown')).toContain('Kerghan');
  });

  it('always renders the header', () => {
    expect(markupFor('home')).toContain('navbar');
  });
});
