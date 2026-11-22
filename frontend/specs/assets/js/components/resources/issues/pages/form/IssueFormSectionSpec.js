import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import IssueFormHelper from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormHelper.jsx';
import IssueFormSection from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormSection.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../../support/fakeWindow.js';
import { buildIssue, buildProject } from '../../../../../../../support/issuesBuilders.js';

describe('IssueFormSection', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('renders the form (the leave prompt stays hidden until a dirty form is left)', () => {
    installFakeWindow({ location: { hash: '' } });
    spyOn(IssueFormHelper, 'render').and.returnValue(React.createElement('div', null, 'form'));

    const html = renderToStaticMarkup(React.createElement(IssueFormSection, {
      project: buildProject(), issue: buildIssue(), onNotFound: () => undefined,
    }));

    expect(html).toContain('form');
    expect(IssueFormHelper.render.calls.mostRecent().args[0].mode).toBe('edit');
  });
});
