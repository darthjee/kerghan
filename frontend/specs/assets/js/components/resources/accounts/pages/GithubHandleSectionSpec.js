import GithubHandleSection, { buildLoadEffect } from '../../../../../../../assets/js/components/resources/accounts/pages/GithubHandleSection.jsx';
import GithubHandleHelper from '../../../../../../../assets/js/components/resources/accounts/pages/helpers/GithubHandleHelper.jsx';
import GithubHandleController from '../../../../../../../assets/js/components/resources/accounts/pages/controllers/GithubHandleController.js';
import { renderCapturingHandlers } from '../../../../../../support/renderCapturingHandlers.js';

describe('GithubHandleSection', () => {
  describe('buildLoadEffect', () => {
    it('calls load once', () => {
      const controller = jasmine.createSpyObj('controller', ['load']);

      buildLoadEffect(controller)();

      expect(controller.load).toHaveBeenCalledTimes(1);
    });
  });

  it('renders through the helper with the initial state', () => {
    renderCapturingHandlers(GithubHandleSection, GithubHandleHelper);

    expect(GithubHandleHelper.render).toHaveBeenCalledWith(
      jasmine.objectContaining({ handle: '', loading: true }),
      jasmine.objectContaining({ onSubmit: jasmine.any(Function), onChange: jasmine.any(Function) }),
    );
  });

  it('saves the current handle on submit, preventing default navigation', () => {
    spyOn(GithubHandleController.prototype, 'save').and.resolveTo();
    const handlers = renderCapturingHandlers(GithubHandleSection, GithubHandleHelper);
    const event = { preventDefault: jasmine.createSpy('preventDefault') };

    handlers.onSubmit(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(GithubHandleController.prototype.save).toHaveBeenCalledWith('');
  });

  it('patches the handle on change', () => {
    spyOn(GithubHandleController.prototype, 'patch');
    const handlers = renderCapturingHandlers(GithubHandleSection, GithubHandleHelper);

    handlers.onChange({ target: { value: 'abc' } });

    expect(GithubHandleController.prototype.patch).toHaveBeenCalledWith({ handle: 'abc' });
  });
});
