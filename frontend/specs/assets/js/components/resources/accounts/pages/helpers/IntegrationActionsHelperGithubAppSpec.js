import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationActionsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationActionsHelper.jsx';
import GithubAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/githubApp.js';
import OauthAppType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/oauthApp.js';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';
import { taggedHandlers } from '../../../../../../../support/taggedHandlers.js';

describe('IntegrationActionsHelper (github_app)', () => {
  const INSTALL = 'Reconnect: Install on GitHub';
  const CONNECT = 'Reconnect: Connect existing installation';
  const enabled = [PatType, OauthAppType, GithubAppType];
  const integration = {
    id: 'abc', type: 'github_app', label: 'Work', status: 'active', nextTestAt: null, githubLogin: 'acme',
  };
  let handlers;
  const render = (overrides = {}, row = {}, types = enabled) => IntegrationActionsHelper.render(
    { ...integration, ...overrides }, row, handlers, types,
  );

  beforeEach(() => {
    handlers = taggedHandlers();
  });

  describe('while the type is enabled', () => {
    it('offers both reconnect modes instead of Replace credential', () => {
      const tree = render();

      expect(findButton(tree, 'Replace credential')).toBeUndefined();
      expect(findButton(tree, 'Reconnect with GitHub')).toBeUndefined();
      expect(findButton(tree, INSTALL).props.onClick).toBe('onReconnect:abc:install');
      expect(findButton(tree, CONNECT).props.onClick).toBe('onReconnect:abc:connect');
      expect(findButton(tree, INSTALL).props.disabled).toBeFalse();
    });

    it('highlights reconnect for an invalid row', () => {
      expect(findButton(render({ status: 'invalid' }), INSTALL).props.className).toContain('btn-warning');
    });

    it('keeps Test enabled and shows no disabled note', () => {
      const tree = render();

      expect(findButton(tree, 'Test').props.disabled).toBeFalse();
      expect(renderToStaticMarkup(tree)).not.toContain('disabled on this server');
    });

    it('opens no credential form', () => {
      expect(findElements(render({}, { replacing: true }), (node) => node.type === 'form')).toEqual([]);
    });
  });

  describe('while the type is disabled on the server', () => {
    const disabled = [PatType, OauthAppType];

    it('shows Test and both reconnect buttons disabled, with the note', () => {
      const tree = render({}, {}, disabled);

      expect(findButton(tree, 'Test').props.disabled).toBeTrue();
      expect(findButton(tree, INSTALL).props.disabled).toBeTrue();
      expect(findButton(tree, CONNECT).props.disabled).toBeTrue();
      expect(renderToStaticMarkup(tree)).toContain('The GitHub App is disabled on this server.');
    });

    it('still allows rename and remove', () => {
      const tree = render({}, {}, disabled);

      expect(findButton(tree, 'Rename').props.disabled).toBeUndefined();
      expect(findButton(tree, 'Remove').props.disabled).toBeUndefined();
    });

    it('leaves oauth_app rows unchanged (reconnect hidden, test enabled)', () => {
      const tree = render({ type: 'oauth_app' }, {}, [PatType]);

      expect(findButton(tree, 'Reconnect with GitHub')).toBeUndefined();
      expect(findButton(tree, 'Test').props.disabled).toBeFalse();
    });
  });

  it('reminds on remove that the app stays installed on the account', () => {
    const markup = renderToStaticMarkup(render({}, { confirmingRemove: true }));

    expect(markup).toContain('Kerghan&#x27;s GitHub App stays installed on acme, and other connections may still use it.');
    expect(markup).toContain('Uninstall it on GitHub if you no longer want it.');
  });
});
