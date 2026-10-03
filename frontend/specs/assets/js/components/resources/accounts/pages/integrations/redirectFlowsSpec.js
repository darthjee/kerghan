import GithubAppFlow from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/githubAppFlow.js';
import RedirectFlow from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/redirectFlow.js';
import RedirectFlows from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/redirectFlows.js';

describe('RedirectFlows', () => {
  const controller = {};

  describe('.startBody', () => {
    it('adds the mode when given', () => {
      expect(RedirectFlows.startBody({ label: 'Work' }, 'connect')).toEqual({ label: 'Work', mode: 'connect' });
    });

    it('leaves the body alone without a mode', () => {
      expect(RedirectFlows.startBody({ integrationId: 'a' }, undefined)).toEqual({ integrationId: 'a' });
    });
  });

  describe('.start', () => {
    it('dispatches oauth_app to the OAuth App flow', async () => {
      spyOn(RedirectFlow, 'start').and.resolveTo();

      await RedirectFlows.start(controller, 'oauth_app', { label: 'Work' });

      expect(RedirectFlow.start).toHaveBeenCalledOnceWith(controller, { label: 'Work' });
    });

    it('dispatches github_app to the GitHub App flow', async () => {
      spyOn(GithubAppFlow, 'start').and.resolveTo();

      await RedirectFlows.start(controller, 'github_app', { label: 'Work', mode: 'install' });

      expect(GithubAppFlow.start).toHaveBeenCalledOnceWith(controller, { label: 'Work', mode: 'install' });
    });
  });

  describe('.completeLandings', () => {
    it('completes every type\'s landing in turn', async () => {
      spyOn(RedirectFlow, 'completeLanding').and.resolveTo();
      spyOn(GithubAppFlow, 'completeLanding').and.resolveTo();

      await RedirectFlows.completeLandings(controller);

      expect(RedirectFlow.completeLanding).toHaveBeenCalledBefore(GithubAppFlow.completeLanding);
      expect(GithubAppFlow.completeLanding).toHaveBeenCalledOnceWith(controller);
    });
  });
});
