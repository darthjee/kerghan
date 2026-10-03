import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationActionsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationActionsHelper.jsx';
import OauthAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';
import { taggedHandlers } from '../../../../../../../support/taggedHandlers.js';

describe('IntegrationActionsHelper', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');
  let handlers;
  const integration = {
    id: 'abc', type: 'pat', label: 'Work', status: 'active', nextTestAt: null,
  };
  const render = (overrides = {}, row = {}, types = undefined) => IntegrationActionsHelper.render(
    { ...integration, ...overrides }, row, handlers, types,
  );
  const markupOf = (overrides, row) => renderToStaticMarkup(render(overrides, row));

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    handlers = taggedHandlers();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('renders rename, replace, test and remove actions', () => {
    const tree = render();

    expect(findButton(tree, 'Rename').props.onClick).toBe('onStartRename:abc');
    expect(findButton(tree, 'Replace credential').props.onClick).toBe('onStartReplace:abc');
    expect(findButton(tree, 'Test').props.onClick).toBe('onTest:abc');
    expect(findButton(tree, 'Remove').props.onClick).toBe('onAskRemove:abc');
  });

  describe('test button', () => {
    it('is enabled without a cooldown', () => {
      expect(findButton(render(), 'Test').props.disabled).toBeFalse();
    });

    it('is disabled until nextTestAt', () => {
      const tree = render({ nextTestAt: new Date(NOW + 1000).toISOString() });

      expect(findButton(tree, 'Test').props.disabled).toBeTrue();
    });

    it('is enabled once nextTestAt has passed', () => {
      const tree = render({ nextTestAt: new Date(NOW - 1000).toISOString() });

      expect(findButton(tree, 'Test').props.disabled).toBeFalse();
    });

    it('is disabled during a Retry-After cooldown', () => {
      expect(findButton(render({}, { cooldownUntil: NOW + 1000 }), 'Test').props.disabled).toBeTrue();
    });

    it('is re-enabled after the Retry-After cooldown', () => {
      const row = { cooldownUntil: NOW + 1000 };
      jasmine.clock().tick(1000);

      expect(findButton(render({}, row), 'Test').props.disabled).toBeFalse();
    });
  });

  describe('replace credential', () => {
    ['invalid', 'expired', 'undecryptable'].forEach((status) => {
      it(`is highlighted for ${status}`, () => {
        expect(findButton(render({ status }), 'Replace credential').props.className).toContain('btn-warning');
      });
    });

    it('is not highlighted for active', () => {
      expect(findButton(render(), 'Replace credential').props.className).not.toContain('btn-warning');
    });

    it('is hidden for a type without a frontend flow', () => {
      expect(findButton(render({ type: 'unknown_type' }), 'Replace credential')).toBeUndefined();
    });

    it('renders the credential form without a label field while replacing', () => {
      const tree = render({}, { replacing: true, credential: {} });
      const inputs = findElements(tree, (node) => node.type === 'input');
      const form = findElements(tree, (node) => node.type === 'form')[0];

      expect(inputs.map((input) => input.props.type)).toEqual(['password']);
      expect(inputs[0].props.onChange).toBe('onReplaceCredentialChange:abc:token');
      expect(form.props.onSubmit).toBe('onSubmitReplace:abc');
      expect(findButton(tree, 'Cancel').props.onClick).toBe('onCancelReplace:abc');
    });

    it('renders no credential form for a type without a frontend flow', () => {
      const tree = render({ type: 'unknown_type' }, { replacing: true });

      expect(findElements(tree, (node) => node.type === 'form')).toEqual([]);
    });
  });

  describe('rename', () => {
    it('renders the inline form instead of the buttons while renaming', () => {
      const tree = render({}, { renaming: true, label: 'Home' });
      const [input] = findElements(tree, (node) => node.type === 'input');
      const form = findElements(tree, (node) => node.type === 'form')[0];

      expect(findButton(tree, 'Rename')).toBeUndefined();
      expect(input.props.value).toBe('Home');
      expect(input.props.onChange).toBe('onRenameChange:abc');
      expect(form.props.onSubmit).toBe('onSubmitRename:abc');
      expect(findButton(tree, 'Cancel').props.onClick).toBe('onCancelRename:abc');
    });

    it('renders an empty label when none is in the row', () => {
      const [input] = findElements(render({}, { renaming: true }), (node) => node.type === 'input');

      expect(input.props.value).toBe('');
    });
  });

  describe('remove', () => {
    it('asks for confirmation naming the label, with the PAT revoke reminder', () => {
      const markup = markupOf({}, { confirmingRemove: true });

      expect(markup).toContain('Remove &quot;Work&quot;?');
      expect(markup).toContain('Revoke it on GitHub');
    });

    it('wires the confirmation actions', () => {
      const tree = render({}, { confirmingRemove: true });

      expect(findButton(tree, 'Confirm remove').props.onClick).toBe('onConfirmRemove:abc');
      expect(findButton(tree, 'Cancel').props.onClick).toBe('onCancelRemove:abc');
    });

    it('does not ask without a pending removal', () => {
      expect(markupOf({}, {})).not.toContain('Confirm remove');
    });
  });

  it('renders the row error', () => {
    expect(markupOf({}, { error: 'GitHub is unavailable right now. Try again later.' }))
      .toContain('GitHub is unavailable right now. Try again later.');
  });

  describe('reconnect with GitHub (oauth_app)', () => {
    const enabled = [PatType, OauthAppType];
    const oauth = (overrides = {}, row = {}, types = enabled) => render({ type: 'oauth_app', ...overrides }, row, types);

    it('replaces Replace credential with Reconnect with GitHub, starting the redirect', () => {
      const tree = oauth();

      expect(findButton(tree, 'Replace credential')).toBeUndefined();
      expect(findButton(tree, 'Reconnect with GitHub').props.onClick).toBe('onReconnect:abc');
    });

    ['invalid', 'expired', 'undecryptable'].forEach((status) => {
      it(`is highlighted for ${status}`, () => {
        expect(findButton(oauth({ status }), 'Reconnect with GitHub').props.className).toContain('btn-warning');
      });
    });

    it('is not highlighted for active', () => {
      expect(findButton(oauth(), 'Reconnect with GitHub').props.className).not.toContain('btn-warning');
    });

    it('opens no credential form', () => {
      expect(findElements(oauth({}, { replacing: true }), (node) => node.type === 'form')).toEqual([]);
    });

    it('is hidden, with a note, when the type is disabled on the server', () => {
      const tree = oauth({}, {}, [PatType]);

      expect(findButton(tree, 'Reconnect with GitHub')).toBeUndefined();
      expect(renderToStaticMarkup(tree)).toContain('The OAuth App is disabled on this server.');
    });

    it('treats a missing types list as nothing enabled', () => {
      expect(findButton(render({ type: 'oauth_app' }), 'Reconnect with GitHub')).toBeUndefined();
    });

    it('shows no disabled note while the type is enabled', () => {
      expect(renderToStaticMarkup(oauth())).not.toContain('disabled on this server');
    });

    it('shows no disabled note for a paste-flow type', () => {
      expect(markupOf({}, {})).not.toContain('disabled on this server');
    });

    it('reminds that removal tries to revoke the authorization on GitHub', () => {
      const markup = renderToStaticMarkup(oauth({}, { confirmingRemove: true }));

      expect(markup).toContain('Kerghan will also try to revoke this authorization on GitHub.');
      expect(markup).toContain('Other connections of the same GitHub account keep working.');
    });
  });
});
