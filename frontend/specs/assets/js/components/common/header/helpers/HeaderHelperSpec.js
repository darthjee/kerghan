import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeaderHelper from '../../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';

describe('HeaderHelper', () => {
  const onLogout = jasmine.createSpy('onLogout');

  it('renders the brand link to home', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, false, onLogout)));

    expect(markup).toContain('href="#/"');
  });

  describe('when logged out', () => {
    it('renders a Login link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, false, onLogout)));

      expect(markup).toContain('href="#/login"');
      expect(markup).toContain('Login');
    });

    it('renders a Register link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, false, onLogout)));

      expect(markup).toContain('href="#/register"');
      expect(markup).toContain('Register');
    });

    it('renders a Recover placeholder link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, false, onLogout)));

      expect(markup).toContain('href="#/recover"');
      expect(markup).toContain('Recover');
    });

    it('does not render the Logout action', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, false, onLogout)));

      expect(markup).not.toContain('Logout');
    });

    it('does not render the Admin Users link, even when isAdmin is true', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, true, onLogout)));

      expect(markup).not.toContain('href="#/admin/users"');
    });
  });

  describe('when logged in', () => {
    it('renders the Logout action', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, false, onLogout)));

      expect(markup).toContain('Logout');
    });

    it('does not render the Login, Register, or Recover links', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, false, onLogout)));

      expect(markup).not.toContain('href="#/login"');
      expect(markup).not.toContain('href="#/register"');
      expect(markup).not.toContain('href="#/recover"');
    });

    it('does not render the Admin Users link for a non-admin', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, false, onLogout)));

      expect(markup).not.toContain('href="#/admin/users"');
    });

    it('renders the Admin Users link for an admin', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, true, onLogout)));

      expect(markup).toContain('href="#/admin/users"');
      expect(markup).toContain('Admin Users');
    });
  });
});
