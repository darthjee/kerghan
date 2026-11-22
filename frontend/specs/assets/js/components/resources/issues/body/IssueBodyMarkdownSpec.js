import React from 'react';
import IssueBodyMarkdown from '../../../../../../../assets/js/components/resources/issues/body/IssueBodyMarkdown.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('IssueBodyMarkdown', () => {
  const render = (body) => renderedOutput(React.createElement(IssueBodyMarkdown, { body }));

  describe('raw HTML', () => {
    ['<script>alert(1)</script>', '<iframe src="https://evil.test"></iframe>', '<details><summary>x</summary></details>']
      .forEach((html) => {
        it(`shows ${html} as escaped text, never interpreted`, () => {
          const rendered = render(`before\n\n${html}\n\nafter`);
          const tagName = html.slice(1, html.search(/[ >]/));

          expect(rendered.containsTag(tagName)).toBeFalse();
          expect(rendered.contains(`&lt;${tagName}`)).toBeTrue();
          expect(rendered.contains('before')).toBeTrue();
          expect(rendered.contains('after')).toBeTrue();
        });
      });

    it('shows inline HTML as text', () => {
      const rendered = render('a <b>bold</b> word');

      expect(rendered.containsTag('b')).toBeFalse();
      expect(rendered.contains('&lt;b&gt;')).toBeTrue();
    });
  });

  describe('links', () => {
    ['http://example.com', 'https://example.com', 'mailto:a@example.com'].forEach((url) => {
      it(`links ${url} with rel and target`, () => {
        const rendered = render(`[text](${url})`);

        expect(rendered.containsAttribute('href', url)).toBeTrue();
        expect(rendered.containsAttribute('rel', 'noopener noreferrer')).toBeTrue();
        expect(rendered.containsAttribute('target', '_blank')).toBeTrue();
      });
    });

    ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', '/relative', 'relative/path',
      '//evil.test/x', 'https:/x', 'https:x', 'http:#/x'].forEach((url) => {
      it(`shows ${url} as its text only`, () => {
        const rendered = render(`[click me](${url})`);

        expect(rendered.containsTag('a')).toBeFalse();
        expect(rendered.contains('click me')).toBeTrue();
      });
    });

    it('autolinks a plain https URL', () => {
      expect(render('see https://example.com now').containsAttribute('href', 'https://example.com')).toBeTrue();
    });
  });

  describe('images', () => {
    let fetchSpy;
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      fetchSpy = jasmine.createSpy('fetch');
      globalThis.fetch = fetchSpy;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('never renders an img, links an https image by its alt text and makes no request', () => {
      const rendered = render('![a cat](https://example.com/cat.png)');

      expect(rendered.containsTag('img')).toBeFalse();
      expect(rendered.containsElement('a', 'a cat')).toBeTrue();
      expect(rendered.containsAttribute('href', 'https://example.com/cat.png')).toBeTrue();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('labels an image without alt text "image"', () => {
      expect(render('![](https://example.com/cat.png)').containsElement('a', 'image')).toBeTrue();
    });

    it('shows a non-http image as text', () => {
      const rendered = render('![a cat](data:image/png;base64,AAAA)');

      expect(rendered.containsTag('img')).toBeFalse();
      expect(rendered.containsTag('a')).toBeFalse();
      expect(rendered.contains('a cat')).toBeTrue();
    });

    ['https:/x', 'https:x', 'http:#/x'].forEach((url) => {
      it(`shows an image with the scheme-only URL ${url} as text`, () => {
        const rendered = render(`![a cat](${url})`);

        expect(rendered.containsTag('img')).toBeFalse();
        expect(rendered.containsTag('a')).toBeFalse();
        expect(rendered.contains('a cat')).toBeTrue();
      });
    });

    it('does not nest an anchor when an image is inside a link', () => {
      const rendered = render('[![a cat](https://a.test/cat.png)](https://b.test)');

      expect(rendered.containsAttribute('href', 'https://b.test')).toBeTrue();
      expect(rendered.containsAttribute('href', 'https://a.test/cat.png')).toBeFalse();
      expect(rendered.contains('<a href="https://b.test" rel="noopener noreferrer" target="_blank">a cat</a>')).toBeTrue();
    });

    it('shows a relative image as text', () => {
      const rendered = render('![a cat](/cat.png)');

      expect(rendered.containsTag('img')).toBeFalse();
      expect(rendered.containsTag('a')).toBeFalse();
    });
  });

  it('renders task list checkboxes disabled', () => {
    const rendered = render('- [x] done\n- [ ] todo');

    expect(rendered.containsTag('input')).toBeTrue();
    expect(rendered.containsAttribute('type', 'checkbox')).toBeTrue();
    expect(rendered.contains('disabled=""')).toBeTrue();
  });

  it('keeps @mention, #123 and SHAs as plain text', () => {
    const rendered = render('thanks @someone for #123, fixed in 1a2b3c4d5e6f');

    expect(rendered.containsTag('a')).toBeFalse();
    expect(rendered.contains('@someone')).toBeTrue();
    expect(rendered.contains('#123')).toBeTrue();
  });

  it('renders GFM structures', () => {
    const rendered = render('# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~');

    expect(rendered.containsTag('h1')).toBeTrue();
    expect(rendered.containsTag('table')).toBeTrue();
    expect(rendered.containsTag('del')).toBeTrue();
  });
});
