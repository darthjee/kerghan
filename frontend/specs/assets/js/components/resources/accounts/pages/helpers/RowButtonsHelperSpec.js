import RowButtonsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/RowButtonsHelper.jsx';
import PatType from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/types/pat.js';
import { findButton } from '../../../../../../../support/elementTree.js';
import { taggedHandlers } from '../../../../../../../support/taggedHandlers.js';

describe('RowButtonsHelper', () => {
  describe('.isEnabled', () => {
    it('is true for a listed type', () => {
      expect(RowButtonsHelper.isEnabled('pat', [PatType])).toBeTrue();
    });

    it('is false for an unlisted type', () => {
      expect(RowButtonsHelper.isEnabled('github_app', [PatType])).toBeFalse();
    });
  });

  describe('.render', () => {
    it('renders rename, replace, test and remove for a paste-flow row', () => {
      const tree = RowButtonsHelper.render(
        { id: 'abc', type: 'pat', status: 'active', nextTestAt: null }, {}, [PatType], taggedHandlers(),
      );

      expect(findButton(tree, 'Rename').props.onClick).toBe('onStartRename:abc');
      expect(findButton(tree, 'Replace credential').props.onClick).toBe('onStartReplace:abc');
      expect(findButton(tree, 'Test').props.onClick).toBe('onTest:abc');
      expect(findButton(tree, 'Remove').props.onClick).toBe('onAskRemove:abc');
    });
  });
});
