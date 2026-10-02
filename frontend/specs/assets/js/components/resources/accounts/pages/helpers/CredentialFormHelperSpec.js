import { renderToStaticMarkup } from 'react-dom/server';
import CredentialFormHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/CredentialFormHelper.jsx';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';

describe('CredentialFormHelper', () => {
  describe('.renderTypePicker', () => {
    const handlers = {
      onPickType: jasmine.createSpy('onPickType').and.callFake((type) => `pick-${type}`),
      onCancel: jasmine.createSpy('onCancel'),
    };

    it('lists each available type with its description', () => {
      const markup = renderToStaticMarkup(CredentialFormHelper.renderTypePicker([PatType], handlers));

      expect(markup).toContain('Personal Access Token');
      expect(markup).toContain('Paste a GitHub personal access token (classic or fine-grained).');
    });

    it('picks the type on click', () => {
      const tree = CredentialFormHelper.renderTypePicker([PatType], handlers);
      const choice = findElements(tree, (node) => node.type === 'button' && node.key === 'pat')[0];

      expect(handlers.onPickType).toHaveBeenCalledWith('pat');
      expect(choice.props.onClick).toBe('pick-pat');
    });

    it('explains when no type is available', () => {
      const markup = renderToStaticMarkup(CredentialFormHelper.renderTypePicker([], handlers));

      expect(markup).toContain('No integration type is available on this server.');
    });

    it('offers a cancel action', () => {
      const tree = CredentialFormHelper.renderTypePicker([], handlers);

      expect(findButton(tree, 'Cancel').props.onClick).toBe(handlers.onCancel);
    });
  });

  describe('.renderForm', () => {
    const handlers = {
      onSubmit: jasmine.createSpy('onSubmit'),
      onLabelChange: jasmine.createSpy('onLabelChange'),
      onCredentialChange: jasmine.createSpy('onCredentialChange').and.callFake((field) => `change-${field}`),
      onCancel: jasmine.createSpy('onCancel'),
    };
    const form = {
      definition: PatType,
      idPrefix: 'add',
      label: 'Work',
      credential: { token: 'ghp_typed' },
      error: null,
      title: 'Add Personal Access Token',
      submitLabel: 'Add',
    };
    const inputs = (tree) => findElements(tree, (node) => node.type === 'input');

    it('renders the label as a plain text input', () => {
      const [label] = inputs(CredentialFormHelper.renderForm(form, handlers));

      expect(label.props.type).toBe('text');
      expect(label.props.value).toBe('Work');
      expect(label.props.onChange).toBe(handlers.onLabelChange);
    });

    it('renders the token as a password input with autocomplete off', () => {
      const [, token] = inputs(CredentialFormHelper.renderForm(form, handlers));

      expect(token.props.type).toBe('password');
      expect(token.props.autoComplete).toBe('off');
      expect(token.props.value).toBe('ghp_typed');
      expect(token.props.onChange).toBe('change-token');
    });

    it('renders autocomplete="off" in the markup', () => {
      expect(renderToStaticMarkup(CredentialFormHelper.renderForm(form, handlers))).toContain('autoComplete="off"');
    });

    it('renders an empty token when none was typed', () => {
      const [, token] = inputs(CredentialFormHelper.renderForm({ ...form, credential: {} }, handlers));

      expect(token.props.value).toBe('');
    });

    it('omits the label field when the form has none', () => {
      const fields = inputs(CredentialFormHelper.renderForm({ ...form, label: undefined }, handlers));

      expect(fields.map((input) => input.props.type)).toEqual(['password']);
    });

    it('renders the PAT guidance: links, recommendation and classic warning', () => {
      const markup = renderToStaticMarkup(CredentialFormHelper.renderForm(form, handlers));

      expect(markup).toContain('https://github.com/settings/personal-access-tokens');
      expect(markup).toContain('https://github.com/settings/tokens');
      expect(markup).toContain('Prefer a fine-grained token');
      expect(markup).toContain('repo scope');
    });

    it('omits absent guidance notes', () => {
      const definition = { credentialFields: [] };
      const markup = renderToStaticMarkup(CredentialFormHelper.renderForm({ ...form, definition }, handlers));

      expect(markup).not.toContain('Prefer a fine-grained token');
    });

    it('renders the error', () => {
      const markup = renderToStaticMarkup(CredentialFormHelper.renderForm({ ...form, error: 'Label taken' }, handlers));

      expect(markup).toContain('Label taken');
    });

    it('wires submit and cancel', () => {
      const tree = CredentialFormHelper.renderForm(form, handlers);

      expect(tree.props.onSubmit).toBe(handlers.onSubmit);
      expect(findButton(tree, 'Cancel').props.onClick).toBe(handlers.onCancel);
      expect(findButton(tree, 'Add').props.type).toBe('submit');
    });
  });
});
