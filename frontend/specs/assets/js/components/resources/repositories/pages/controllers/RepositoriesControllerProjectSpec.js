import { useRepositoriesControllerHarness } from '../../../../../../../support/repositoriesControllerHarness.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('RepositoriesController project shortcut', () => {
  const context = useRepositoriesControllerHarness();
  const repository = { githubId: 7, fullName: 'darthjee/kerghan' };

  it('opens the project of a repository and navigates to its page', async () => {
    context.projectsClient.createFromRepository.and.resolveTo(buildProject());

    await context.buildController().openProject(repository);

    expect(context.projectsClient.createFromRepository).toHaveBeenCalledWith({ githubId: 7 });
    expect(context.location.push).toHaveBeenCalledWith(`#/projects/${PROJECT_ID}`);
  });

  it('shows the pending state while it runs, and clears it on dispose', () => {
    context.projectsClient.createFromRepository.and.returnValue(new Promise(Function.prototype));
    const controller = context.buildController();

    controller.openProject(repository);
    expect(context.state.projectState.get(7)).toEqual({ status: 'pending' });

    controller.dispose();
    expect(context.state.projectState.size).toBe(0);
  });
});
