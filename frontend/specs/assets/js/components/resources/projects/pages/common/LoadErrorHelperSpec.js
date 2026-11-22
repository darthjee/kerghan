import LoadErrorHelper from '../../../../../../../../assets/js/components/resources/projects/pages/common/LoadErrorHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';

describe('LoadErrorHelper', () => {
  it('shows a danger alert with the message and a Retry button wired to the handler', () => {
    const onRetry = jasmine.createSpy('onRetry');
    const tree = LoadErrorHelper.render('Boom', onRetry);
    const [alert] = findElements(tree, (node) => node.props?.role === 'alert');
    const [retry] = findElements(tree, (node) => node.type === 'button');

    expect(alert.props.className).toContain('alert-danger');
    expect(alert.props.children[0]).toBe('Boom');
    expect(retry.props.children).toBe('Retry');
    expect(retry.props.onClick).toBe(onRetry);
  });
});
