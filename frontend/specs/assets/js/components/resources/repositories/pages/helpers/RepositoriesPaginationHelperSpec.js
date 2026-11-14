import React from 'react';
import RepositoriesPaginationHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesPaginationHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const noop = Function.prototype;

describe('RepositoriesPaginationHelper', () => {
  const onPageChange = jasmine.createSpy('onPageChange').and.returnValue(noop);
  const render = (page, totalPages) => RepositoriesPaginationHelper.render(
    { page, perPage: 50, total: 1, totalPages }, { onPageChange },
  );

  it('renders nothing for a single page', () => {
    expect(render(1, 1)).toBeNull();
  });

  it('renders nothing without pages', () => {
    expect(render(1, 0)).toBeNull();
  });

  it('renders a window of pages around the current one', () => {
    const output = renderedOutput(React.createElement('div', null, render(5, 20)));

    [3, 4, 5, 6, 7].forEach((number) => expect(output.contains(`>${number}<`)).toBeTrue());
    expect(output.contains('>2<')).toBeFalse();
    expect(output.contains('>8<')).toBeFalse();
  });

  it('marks the current page active', () => {
    expect(renderedOutput(React.createElement('div', null, render(2, 3))).contains('active')).toBeTrue();
  });

  it('asks for the page of the clicked item, previous and next', () => {
    onPageChange.calls.reset();
    findElements(render(2, 3), (node) => node.props?.onClick).forEach((node) => node.props.onClick);

    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
