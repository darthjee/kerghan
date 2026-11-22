import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueFormController from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormController.js';
import useIssueForm from '../../../../../../../../assets/js/components/resources/issues/pages/form/useIssueForm.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import {
  buildIssue, buildLink, buildProject, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';

describe('useIssueForm', () => {
  let form;
  let fakeWindow;

  const render = (issue) => {
    function Probe() {
      form = useIssueForm({ project: buildProject(), issue, onNotFound: () => undefined });
      return null;
    }

    renderToStaticMarkup(React.createElement(Probe));
  };

  beforeEach(() => {
    fakeWindow = installFakeWindow({ location: { hash: '' } });
  });

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts the creation form empty and on the Write tab', () => {
    render(null);

    expect(form.state).toEqual(jasmine.objectContaining({
      mode: 'new', title: '', body: '', state: 'open', tab: 'write', link: null,
      fieldErrors: {}, formError: null, submitting: false,
    }));
    expect(form.state.countdown.active).toBe(false);
  });

  it('starts the edit form from the issue, with its link', () => {
    const link = buildLink();

    render(buildIssue({ title: 'T', body: null, state: 'closed', link }));

    expect(form.state).toEqual(jasmine.objectContaining({
      mode: 'edit', title: 'T', body: '', state: 'closed', link,
    }));
  });

  it('creates on submit in creation mode, and saves in edit mode', () => {
    spyOn(IssueFormController.prototype, 'create').and.resolveTo();
    spyOn(IssueFormController.prototype, 'save').and.resolveTo();
    const event = { preventDefault: jasmine.createSpy('preventDefault') };

    render(null);
    form.handlers.onSubmit(event);
    render(buildIssue());
    form.handlers.onSubmit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(IssueFormController.prototype.create).toHaveBeenCalledOnceWith(PROJECT_ID, jasmine.any(Object), jasmine.any(Function));
    expect(IssueFormController.prototype.save).toHaveBeenCalledOnceWith(PROJECT_ID, ISSUE_ID, jasmine.any(Object), jasmine.any(Function));
  });

  it('U11: Cancel of a clean creation form goes back to the project page, without asking', () => {
    render(null);

    form.handlers.onCancel();

    expect(form.guard.pendingHash).toBeNull();
    expect(fakeWindow.location.hash).toBe(`#/projects/${PROJECT_ID}`);
  });

  it('U11: Cancel of a clean edit form goes back to the issue page, without asking', () => {
    render(buildIssue());

    form.handlers.onCancel();

    expect(fakeWindow.location.hash).toBe(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
  });

  it('S4: writes nothing to storage', () => {
    const storage = jasmine.createSpyObj('storage', ['setItem']);

    fakeWindow.localStorage = storage;
    fakeWindow.sessionStorage = storage;
    render(buildIssue());

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('U10: starts without the changed banner, on the edit form and the creation form', () => {
    render(buildIssue());
    expect(form.state.changed).toBe(false);

    render(null);
    expect(form.state.changed).toBe(false);
  });

  it('U10: offers discard-and-reload through its handlers', () => {
    render(buildIssue());

    expect(form.handlers.onDiscardAndReload).toEqual(jasmine.any(Function));
  });
});
