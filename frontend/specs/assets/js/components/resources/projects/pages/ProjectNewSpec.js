import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DirtyFormPrompt from '../../../../../../../assets/js/components/common/forms/DirtyFormPrompt.jsx';
import ProjectNew from '../../../../../../../assets/js/components/resources/projects/pages/ProjectNew.jsx';
import ProjectNewHelper from '../../../../../../../assets/js/components/resources/projects/pages/new/ProjectNewHelper.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('ProjectNew', () => {
  let state;
  let handlers;

  const render = (hash = '#/projects/new') => {
    installFakeWindow({ location: { hash } });
    spyOn(ProjectNewHelper, 'render').and.callFake((helperState, helperHandlers) => {
      state = helperState;
      handlers = helperHandlers;
      return React.createElement('div');
    });

    return renderToStaticMarkup(React.createElement(ProjectNew));
  };

  afterEach(() => {
    uninstallFakeWindow();
  });

  it('starts with empty fields, no errors and an idle button', () => {
    render();

    expect(state).toEqual({
      name: '', description: '', repository: null, fieldErrors: {}, formError: null, submitting: false,
    });
  });

  it('starts prefilled from the hash query', () => {
    render('#/projects/new?repository=7&repositoryName=a%2Fb&name=a%2Fb');

    expect(state.name).toBe('a/b');
    expect(state.repository).toEqual({ githubId: 7, fullName: 'a/b' });
    expect(state.fieldErrors).toEqual({});
  });

  it('shows the name-taken error on Name when the shortcut fell back to the form', () => {
    render('#/projects/new?repository=7&repositoryName=a%2Fb&name=a%2Fb&error=name_taken');

    expect(state.fieldErrors).toEqual({ name: { message: 'A project with this name already exists' } });
  });

  it('wires the change handlers', () => {
    render();

    expect(handlers).toEqual(jasmine.objectContaining({
      onNameChange: jasmine.any(Function),
      onDescriptionChange: jasmine.any(Function),
      onRepositoryChange: jasmine.any(Function),
      onSubmit: jasmine.any(Function),
      onCancel: jasmine.any(Function),
    }));
  });

  it('goes back to the list on Cancel when the form is clean, without asking (U11)', () => {
    render();

    handlers.onCancel();

    expect(globalThis.window.location.hash).toBe('#/projects');
  });

  it('renders the dirty-form prompt next to the form, hidden while nothing is pending', () => {
    const markup = render();

    expect(DirtyFormPrompt({ guard: { pendingHash: null } })).toBeNull();
    expect(markup).not.toContain('Discard unsaved changes?');
  });
});
