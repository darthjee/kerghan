import React from 'react';
import IssueChangedBanner from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueChangedBanner.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueChangedBanner (U10)', () => {
  it('U10: renders nothing while the issue is unchanged', () => {
    expect(renderedOutput(React.createElement(IssueChangedBanner, { visible: false, onDiscard: () => undefined })).isEmpty()).toBe(true);
  });

  it('U10: shows the warning and the discard action once the issue changed', () => {
    const output = renderedOutput(React.createElement(IssueChangedBanner, { visible: true, onDiscard: () => undefined }));

    expect(output.contains('This issue changed since you opened it')).toBe(true);
    expect(output.containsElement('button', 'Discard my changes and reload')).toBe(true);
    expect(output.contains('role="alert"')).toBe(true);
  });

  it('U10: calls onDiscard from the button', () => {
    const onDiscard = jasmine.createSpy('onDiscard');
    const tree = IssueChangedBanner({ visible: true, onDiscard });
    const button = tree.props.children[1];

    button.props.onClick();

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
