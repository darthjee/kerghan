import React from 'react';
import GithubLink from '../../../../../../../assets/js/components/resources/issues/link/GithubLink.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('GithubLink', () => {
  const render = (url) => renderedOutput(React.createElement(GithubLink, { number: 12, url }));

  it('links #N to a https://github.com/ URL with rel and target (S2)', () => {
    const rendered = render('https://github.com/darthjee/kerghan/issues/12');

    expect(rendered.containsElement('a', '#12')).toBeTrue();
    expect(rendered.containsAttribute('href', 'https://github.com/darthjee/kerghan/issues/12')).toBeTrue();
    expect(rendered.containsAttribute('rel', 'noopener noreferrer')).toBeTrue();
    expect(rendered.containsAttribute('target', '_blank')).toBeTrue();
  });

  ['http://github.com/a/b/issues/1', 'https://github.com.evil/a/b/issues/1', 'javascript:alert(1)', '', undefined, null]
    .forEach((url) => {
      it(`renders nothing for ${JSON.stringify(url)} (S2)`, () => {
        expect(render(url).isEmpty()).toBeTrue();
      });
    });
});
