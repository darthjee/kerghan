import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeaderHelper from '../../../../../../../assets/js/components/common/header/helpers/HeaderHelper.jsx';

describe('HeaderHelper', () => {
  const onLogout = jasmine.createSpy('onLogout');

  it('renders the brand link to home', () => {
    const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

    expect(markup).toContain('href="#/"');
  });

  describe('when logged out', () => {
    it('renders a Login link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

      expect(markup).toContain('href="#/login"');
      expect(markup).toContain('Login');
    });

    it('renders a Register link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

      expect(markup).toContain('href="#/register"');
      expect(markup).toContain('Register');
    });

    it('renders a Recover placeholder link', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

      expect(markup).toContain('href="#/recover"');
      expect(markup).toContain('Recover');
    });

    it('does not render the Logout action', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(false, onLogout)));

      expect(markup).not.toContain('Logout');
    });
  });

  describe('when logged in', () => {
    it('renders the Logout action', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, onLogout)));

      expect(markup).toContain('Logout');
    });

    it('does not render the Login, Register, or Recover links', () => {
      const markup = renderToStaticMarkup(React.createElement('div', null, HeaderHelper.render(true, onLogout)));

      expect(markup).not.toContain('href="#/login"');
      expect(markup).not.toContain('href="#/register"');
      expect(markup).not.toContain('href="#/recover"');
    });
  });
});
