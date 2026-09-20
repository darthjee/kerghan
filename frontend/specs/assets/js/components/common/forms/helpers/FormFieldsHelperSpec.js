import { renderToStaticMarkup } from 'react-dom/server';
import FormFieldsHelper from '../../../../../../../assets/js/components/common/forms/helpers/FormFieldsHelper.jsx';

describe('FormFieldsHelper', () => {
  describe('.renderField', () => {
    const render = (state, onChange = () => {}) => renderToStaticMarkup(
      FormFieldsHelper.renderField('username', 'text', 'Username', state, onChange, 'my-prefix-'),
    );

    it('renders the label, prefixed id, type and current value', () => {
      const html = render({ username: 'foo', fieldErrors: {} });

      expect(html).toContain('for="my-prefix-username"');
      expect(html).toContain('id="my-prefix-username"');
      expect(html).toContain('type="text"');
      expect(html).toContain('value="foo"');
      expect(html).toContain('>Username</label>');
    });

    it('marks the field invalid and shows the error when one is present', () => {
      const html = render({ username: '', fieldErrors: { username: 'is required' } });

      expect(html).toContain('is-invalid');
      expect(html).toContain('<div class="invalid-feedback">is required</div>');
    });

    it('renders no error markup when there is no error for the field', () => {
      const html = render({ username: '', fieldErrors: { email: 'bad' } });

      expect(html).not.toContain('is-invalid');
      expect(html).not.toContain('invalid-feedback');
    });

    it('tolerates a missing fieldErrors object', () => {
      const html = render({ username: '' });

      expect(html).not.toContain('invalid-feedback');
    });

    it('keys the wrapper by the field name and wires the given onChange', () => {
      const onChange = () => {};
      const element = FormFieldsHelper.renderField(
        'username', 'text', 'Username', { username: '' }, onChange, 'p-',
      );

      expect(element.key).toBe('username');
      expect(element.props.children[1].props.onChange).toBe(onChange);
    });
  });

  describe('.renderSubmitError', () => {
    it('renders the danger alert with the error message', () => {
      const html = renderToStaticMarkup(FormFieldsHelper.renderSubmitError({ submitError: 'Boom' }));

      expect(html).toBe('<div class="alert alert-danger">Boom</div>');
    });

    it('returns null when there is no submit error', () => {
      expect(FormFieldsHelper.renderSubmitError({ submitError: null })).toBeNull();
    });
  });

  describe('.renderSuccess', () => {
    it('renders the success alert with the given message', () => {
      const html = renderToStaticMarkup(FormFieldsHelper.renderSuccess({ success: true }, 'Saved.'));

      expect(html).toBe('<div class="alert alert-success">Saved.</div>');
    });

    it('returns null when the save has not succeeded', () => {
      expect(FormFieldsHelper.renderSuccess({ success: false }, 'Saved.')).toBeNull();
    });
  });
});
