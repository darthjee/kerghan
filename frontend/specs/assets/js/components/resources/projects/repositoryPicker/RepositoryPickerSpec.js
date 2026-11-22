import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RepositoryPicker, { buildPickerEffect } from '../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPicker.jsx';
import RepositoryPickerHelper from '../../../../../../../assets/js/components/resources/projects/repositoryPicker/RepositoryPickerHelper.jsx';

describe('RepositoryPicker', () => {
  const capture = (props) => {
    let captured;

    spyOn(RepositoryPickerHelper, 'render').and.callFake((state, handlers, inputId) => {
      captured = { state, handlers, inputId };
      return React.createElement('div');
    });
    renderToStaticMarkup(React.createElement(RepositoryPicker, props));
    return captured;
  };

  it('starts with an empty search, no results and no hint', () => {
    const { state, inputId } = capture({ selected: null, onChange: () => undefined, inputId: 'x' });

    expect(state).toEqual({
      selected: null, search: '', results: [], noneAdded: false, error: null,
    });
    expect(inputId).toBe('x');
  });

  it('passes the chosen repository through', () => {
    const selected = { githubId: 1, fullName: 'a/b' };

    expect(capture({ selected, onChange: () => undefined }).state.selected).toBe(selected);
  });

  it('reports a pick as { githubId, fullName } only', () => {
    const onChange = jasmine.createSpy('onChange');
    const { handlers } = capture({ selected: null, onChange });

    handlers.onPick({ githubId: 1, fullName: 'a/b', status: 'added', sources: [] })();

    expect(onChange).toHaveBeenCalledOnceWith({ githubId: 1, fullName: 'a/b' });
  });

  it('reports Clear as null', () => {
    const onChange = jasmine.createSpy('onChange');
    const { handlers } = capture({ selected: { githubId: 1, fullName: 'a/b' }, onChange });

    handlers.onClear();

    expect(onChange).toHaveBeenCalledOnceWith(null);
  });

  describe('buildPickerEffect', () => {
    it('loads on mount and disposes on cleanup', () => {
      const controller = jasmine.createSpyObj('controller', ['start', 'dispose']);

      const cleanup = buildPickerEffect(controller)();

      expect(controller.start).toHaveBeenCalledTimes(1);
      cleanup();
      expect(controller.dispose).toHaveBeenCalledTimes(1);
    });
  });
});
