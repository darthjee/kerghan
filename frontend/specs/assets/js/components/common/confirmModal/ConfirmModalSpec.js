import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConfirmModal from '../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import ConfirmModalHelper from '../../../../../../assets/js/components/common/confirmModal/helpers/ConfirmModalHelper.jsx';

describe('ConfirmModal', () => {
  let state;
  let handlers;

  const render = (props = {}) => {
    spyOn(ConfirmModalHelper, 'render').and.callFake((helperState, helperHandlers) => {
      state = helperState;
      handlers = helperHandlers;
      return React.createElement('div');
    });

    renderToStaticMarkup(React.createElement(ConfirmModal, {
      title: 'Detach', message: 'Sure?', confirmLabel: 'Detach', onConfirm: () => undefined, onCancel: () => undefined, ...props,
    }));
  };

  it('passes its props and a clean initial state to the helper', () => {
    render({ danger: true, typeToConfirm: 'Kerghan' });

    expect(state).toEqual({
      title: 'Detach',
      message: 'Sure?',
      confirmLabel: 'Detach',
      danger: true,
      typeToConfirm: 'Kerghan',
      typed: '',
      pending: false,
      error: null,
    });
  });

  it('defaults to a non-destructive confirmation', () => {
    render();

    expect(state.danger).toBe(false);
  });

  it('hands the cancel callback to the helper', () => {
    const onCancel = jasmine.createSpy('onCancel');

    render({ onCancel });

    expect(handlers.onCancel).toBe(onCancel);
  });

  it('runs the confirmed action through the controller', async () => {
    const onConfirm = jasmine.createSpy('onConfirm').and.resolveTo();

    render({ onConfirm });
    await handlers.onConfirm();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
