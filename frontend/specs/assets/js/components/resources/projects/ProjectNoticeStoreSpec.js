import ProjectNoticeStore from '../../../../../../assets/js/components/resources/projects/ProjectNoticeStore.js';

describe('ProjectNoticeStore', () => {
  beforeEach(() => {
    ProjectNoticeStore.take();
  });

  it('has no notice by default', () => {
    expect(ProjectNoticeStore.take()).toBeNull();
  });

  it('holds "Project deleted." alone when nothing was unsent', () => {
    ProjectNoticeStore.setDeleted(0);

    expect(ProjectNoticeStore.take()).toEqual(['Project deleted.']);
  });

  it('defaults the unsent count to zero', () => {
    ProjectNoticeStore.setDeleted();

    expect(ProjectNoticeStore.take()).toEqual(['Project deleted.']);
  });

  it('adds the unsent-changes line above zero', () => {
    ProjectNoticeStore.setDeleted(3);

    expect(ProjectNoticeStore.take()).toEqual([
      'Project deleted.', '3 issues had changes that were not sent to GitHub.',
    ]);
  });

  it('uses the singular for one issue', () => {
    ProjectNoticeStore.setDeleted(1);

    expect(ProjectNoticeStore.take()[1]).toBe('1 issue had changes that were not sent to GitHub.');
  });

  it('shows once: taking clears it, so a reload does not repeat it', () => {
    ProjectNoticeStore.setDeleted(2);

    expect(ProjectNoticeStore.take()).not.toBeNull();
    expect(ProjectNoticeStore.take()).toBeNull();
  });
});
