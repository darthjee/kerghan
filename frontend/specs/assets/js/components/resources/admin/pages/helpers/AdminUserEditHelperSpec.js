import { renderToStaticMarkup } from 'react-dom/server';
import AdminUserEditHelper from '../../../../../../../../assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx';

describe('AdminUserEditHelper', () => {
  const buildHandlers = () => ({
    onSubmit: jasmine.createSpy('onSubmit'),
    onChange: jasmine.createSpy('onChange').and.returnValue(jasmine.createSpy('handler')),
  });
  const buildState = (overrides = {}) => ({
    username: '',
    email: '',
    newPassword: '',
    newPasswordConfirmation: '',
    fieldErrors: {},
    submitError: null,
    success: false,
    ...overrides,
  });

  describe('.render', () => {
    it('renders the page heading', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('Edit User');
    });

    it('renders no current-password field, unlike MyAccount', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('Current password');
    });

    it('renders the submit-time error alert when present', () => {
      const html = renderToStaticMarkup(
        AdminUserEditHelper.render(buildState({ submitError: 'Username already in use' }), buildHandlers()),
      );

      expect(html).toContain('Username already in use');
      expect(html).toContain('alert-danger');
    });

    it('renders no submit-error alert when there is none', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-danger');
    });

    it('renders a success confirmation once the save succeeded', () => {
      const html = renderToStaticMarkup(
        AdminUserEditHelper.render(buildState({ success: true }), buildHandlers()),
      );

      expect(html).toContain('alert-success');
      expect(html).toContain('User updated.');
    });

    it('renders no success confirmation before a save', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('alert-success');
    });

    it('renders the current field values', () => {
      const html = renderToStaticMarkup(
        AdminUserEditHelper.render(buildState({ username: 'foo', email: 'foo@example.com' }), buildHandlers()),
      );

      expect(html).toContain('value="foo"');
      expect(html).toContain('value="foo@example.com"');
    });

    it('renders an inline error for an invalid field', () => {
      const html = renderToStaticMarkup(
        AdminUserEditHelper.render(buildState({ fieldErrors: { email: 'Email is invalid' } }), buildHandlers()),
      );

      expect(html).toContain('Email is invalid');
      expect(html).toContain('is-invalid');
    });

    it('renders no inline error for a field with no recorded error', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).not.toContain('is-invalid');
    });

    it('wires each field\'s change handler with its own field name', () => {
      const handlers = buildHandlers();
      renderToStaticMarkup(AdminUserEditHelper.render(buildState(), handlers));

      expect(handlers.onChange).toHaveBeenCalledWith('username');
      expect(handlers.onChange).toHaveBeenCalledWith('email');
      expect(handlers.onChange).toHaveBeenCalledWith('newPassword');
      expect(handlers.onChange).toHaveBeenCalledWith('newPasswordConfirmation');
    });

    it('wires the form submission to the submit handler', () => {
      const html = renderToStaticMarkup(AdminUserEditHelper.render(buildState(), buildHandlers()));

      expect(html).toContain('<form');
      expect(html).toContain('>Save<');
    });
  });
});
