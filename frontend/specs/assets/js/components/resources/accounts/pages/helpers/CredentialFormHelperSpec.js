import { renderToStaticMarkup } from 'react-dom/server';
import CredentialFormHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/CredentialFormHelper.jsx';
import GithubAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/githubApp.js';
import OauthAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';
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

  describe('.renderForm with a redirect-flow type', () => {
    const handlers = {
      onSubmit: jasmine.createSpy('onSubmit'),
      onLabelChange: jasmine.createSpy('onLabelChange'),
      onCredentialChange: jasmine.createSpy('onCredentialChange'),
      onCancel: jasmine.createSpy('onCancel'),
    };
    const form = {
      definition: OauthAppType,
      idPrefix: 'add',
      label: 'Work',
      credential: {},
      error: null,
      title: 'Add OAuth App',
      submitLabel: 'Add',
    };
    const render = (overrides = {}) => CredentialFormHelper.renderForm({ ...form, ...overrides }, handlers);

    it('renders only the label input, with no credential field', () => {
      const inputs = findElements(render(), (node) => node.type === 'input');

      expect(inputs.length).toBe(1);
      expect(inputs[0].props.type).toBe('text');
      expect(inputs[0].props.value).toBe('Work');
      expect(inputs[0].props.onChange).toBe(handlers.onLabelChange);
      expect(renderToStaticMarkup(render())).not.toContain('password');
    });

    it('shows the description and every warning', () => {
      const markup = renderToStaticMarkup(render());

      expect(markup).toContain('Connect a GitHub account by authorizing Kerghan&#x27;s OAuth App.');
      OauthAppType.warnings.forEach((warning) => expect(markup).toContain(warning));
    });

    it('tolerates a definition without warnings', () => {
      const definition = { flow: 'redirect' };

      expect(renderToStaticMarkup(render({ definition }))).toContain('Continue to GitHub');
    });

    it('submits with Continue to GitHub and offers cancel', () => {
      const tree = render();

      expect(tree.props.onSubmit).toBe(handlers.onSubmit);
      expect(findButton(tree, 'Continue to GitHub').props.type).toBe('submit');
      expect(findButton(tree, 'Add')).toBeUndefined();
      expect(findButton(tree, 'Cancel').props.onClick).toBe(handlers.onCancel);
    });

    it('renders the error', () => {
      expect(renderToStaticMarkup(render({ error: 'Label taken' }))).toContain('Label taken');
    });
  });

  describe('.renderForm with a multi-mode redirect type', () => {
    const handlers = {
      onSubmit: jasmine.createSpy('onSubmit'),
      onSubmitMode: jasmine.createSpy('onSubmitMode').and.callFake((mode) => `mode-${mode}`),
      onLabelChange: jasmine.createSpy('onLabelChange'),
      onCancel: jasmine.createSpy('onCancel'),
    };
    const render = () => CredentialFormHelper.renderForm({
      definition: GithubAppType, idPrefix: 'add', label: 'Work', credential: {}, error: null, title: 'Add GitHub App',
    }, handlers);

    it('offers Install on GitHub and Connect existing installation instead of Continue', () => {
      const tree = render();

      expect(findButton(tree, 'Continue to GitHub')).toBeUndefined();
      expect(findButton(tree, 'Install on GitHub').props.onClick).toBe('mode-install');
      expect(findButton(tree, 'Install on GitHub').props.type).toBe('button');
      expect(findButton(tree, 'Connect existing installation').props.onClick).toBe('mode-connect');
      expect(findButton(tree, 'Cancel').props.onClick).toBe(handlers.onCancel);
    });

    it('shows the connect hint, the description and the warnings', () => {
      const markup = renderToStaticMarkup(render());

      expect(markup).toContain('Use this if the app is already installed on your account or organization.');
      expect(markup).toContain('no token is stored');
      expect(markup).toContain('read access to issues and metadata');
      expect(markup).toContain('without admin rights');
    });

    it('keeps only the label input', () => {
      const inputs = findElements(render(), (node) => node.type === 'input');

      expect(inputs.map((input) => input.props.type)).toEqual(['text']);
    });
  });
});
