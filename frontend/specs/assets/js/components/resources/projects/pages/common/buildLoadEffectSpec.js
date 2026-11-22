import buildLoadEffect from '../../../../../../../../assets/js/components/resources/projects/pages/common/buildLoadEffect.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('buildLoadEffect', () => {
  it('loads the project on mount and ignores late answers after cleanup', () => {
    const controller = jasmine.createSpyObj('controller', ['load', 'dispose']);

    const cleanup = buildLoadEffect(controller, PROJECT_ID)();

    expect(controller.load).toHaveBeenCalledOnceWith(PROJECT_ID);
    cleanup();
    expect(controller.dispose).toHaveBeenCalledTimes(1);
  });
});
