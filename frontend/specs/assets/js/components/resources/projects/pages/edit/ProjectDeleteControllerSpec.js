import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectNoticeStore from '../../../../../../../../assets/js/components/resources/projects/ProjectNoticeStore.js';
import ProjectDeleteController from '../../../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDeleteController.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectDeleteController', () => {
  let client;
  let forceLeave;
  let controller;

  beforeEach(() => {
    ProjectNoticeStore.take();
    client = jasmine.createSpyObj('client', ['delete']);
    client.delete.and.resolveTo({ unsentIssueCount: 0 });
    forceLeave = jasmine.createSpy('forceLeave');
    controller = new ProjectDeleteController(client);
  });

  it('E33: deletes the project, notes it and goes to the project list', async () => {
    await controller.remove(PROJECT_ID, forceLeave);

    expect(client.delete).toHaveBeenCalledOnceWith(PROJECT_ID);
    expect(forceLeave).toHaveBeenCalledOnceWith('#/projects');
    expect(ProjectNoticeStore.take()).toEqual(['Project deleted.']);
  });

  it('E33: adds the count of issues with unsent changes to the notice when above 0', async () => {
    client.delete.and.resolveTo({ unsentIssueCount: 3 });

    await controller.remove(PROJECT_ID, forceLeave);

    expect(ProjectNoticeStore.take()).toEqual([
      'Project deleted.', '3 issues had changes that were not sent to GitHub.',
    ]);
  });

  it('E33: counts a 404 as done, with "Project deleted." and no count', async () => {
    client.delete.and.rejectWith(new ApiError(404, 'Project not found', 'NOT_FOUND'));

    await controller.remove(PROJECT_ID, forceLeave);

    expect(forceLeave).toHaveBeenCalledOnceWith('#/projects');
    expect(ProjectNoticeStore.take()).toEqual(['Project deleted.']);
  });

  it('rejects with any other error, so the modal shows it, without leaving', async () => {
    const error = new ApiError(500, 'Boom', 'INTERNAL');

    client.delete.and.rejectWith(error);

    await expectAsync(controller.remove(PROJECT_ID, forceLeave)).toBeRejectedWith(error);
    expect(forceLeave).not.toHaveBeenCalled();
    expect(ProjectNoticeStore.take()).toBeNull();
  });

  it('stays when the session expired (undefined answer), without a notice', async () => {
    client.delete.and.resolveTo(undefined);

    await controller.remove(PROJECT_ID, forceLeave);

    expect(forceLeave).not.toHaveBeenCalled();
    expect(ProjectNoticeStore.take()).toBeNull();
  });
});
