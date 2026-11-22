import currentHash from '../../../../../assets/js/utils/routing/currentHash.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';

describe('currentHash', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('reads the window location hash', () => {
    installFakeWindow({ location: { hash: '#/projects?page=2' } });

    expect(currentHash()).toBe('#/projects?page=2');
  });

  it('answers an empty string without a window', () => {
    expect(currentHash()).toBe('');
  });
});
