import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AttachIssueController from '../../../../../../../../assets/js/components/resources/issues/link/modals/AttachIssueController.js';
import AttachIssueModal from '../../../../../../../../assets/js/components/resources/issues/link/modals/AttachIssueModal.jsx';
import ImportIssueController from '../../../../../../../../assets/js/components/resources/issues/link/modals/ImportIssueController.js';
import ImportIssueModal from '../../../../../../../../assets/js/components/resources/issues/link/modals/ImportIssueModal.jsx';
import IssueNumberModal from '../../../../../../../../assets/js/components/resources/issues/link/modals/IssueNumberModal.jsx';
import IssueNumberModalHelper from '../../../../../../../../assets/js/components/resources/issues/link/modals/IssueNumberModalHelper.jsx';
import { buildIssue, buildProjectRepository, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('the issue-number modals', () => {
  let captured;
  const repository = buildProjectRepository();

  beforeEach(() => {
    captured = null;
    spyOn(IssueNumberModalHelper, 'render').and.callFake((state, handlers) => {
      captured = { state, handlers };
      return React.createElement('div');
    });
  });

  describe('IssueNumberModal', () => {
    it('starts empty and hands the typed text to onSubmit', () => {
      const onSubmit = jasmine.createSpy('onSubmit');
      const onCancel = () => undefined;

      renderToStaticMarkup(React.createElement(IssueNumberModal, {
        title: 'T', submitLabel: 'Go', pending: false, error: null, onSubmit, onCancel,
      }));

      expect(captured.state).toEqual(jasmine.objectContaining({ title: 'T', submitLabel: 'Go', value: '', pending: false }));
      expect(captured.state.countdown.active).toBeFalse();
      expect(captured.handlers.onCancel).toBe(onCancel);

      const event = { preventDefault: jasmine.createSpy('preventDefault') };

      captured.handlers.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(onSubmit).toHaveBeenCalledOnceWith('');
      expect(captured.handlers.onChange).toEqual(jasmine.any(Function));
    });
  });

  describe('ImportIssueModal', () => {
    it('submits through the import controller', () => {
      spyOn(ImportIssueController.prototype, 'submit').and.resolveTo();
      const onClose = () => undefined;

      renderToStaticMarkup(React.createElement(ImportIssueModal, { projectId: PROJECT_ID, repository, onClose }));

      expect(captured.state.title).toBe('Import a GitHub issue');
      expect(captured.state.submitLabel).toBe('Import');
      captured.handlers.onSubmit({ preventDefault: () => undefined });
      expect(ImportIssueController.prototype.submit).toHaveBeenCalledOnceWith(PROJECT_ID, repository, '');
      expect(captured.handlers.onCancel).toBe(onClose);
    });
  });

  describe('AttachIssueModal', () => {
    const issue = buildIssue();
    const props = {
      projectId: PROJECT_ID, issue, repository, onIssueChange: () => undefined, onReread: () => undefined, onNotFound: () => undefined, onClose: () => undefined,
    };

    it('asks for the issue number first and submits through the attach controller', () => {
      spyOn(AttachIssueController.prototype, 'submit').and.resolveTo();

      renderToStaticMarkup(React.createElement(AttachIssueModal, props));

      expect(captured.state.title).toBe('Link to a GitHub issue');
      expect(captured.state.submitLabel).toBe('Link');
      captured.handlers.onSubmit({ preventDefault: () => undefined });
      expect(AttachIssueController.prototype.submit).toHaveBeenCalledOnceWith(PROJECT_ID, issue.id, repository, '');
    });
  });
});
