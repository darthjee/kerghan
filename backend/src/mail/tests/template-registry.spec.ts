import { join } from 'node:path';
import { buildTemplateRegistry } from '../template-registry.js';

const fixture = (...segments: string[]): string => join(__dirname, 'fixtures', ...segments);

describe('buildTemplateRegistry', () => {
  describe('with a directory of well-formed templates', () => {
    const registry = buildTemplateRegistry(fixture('templates-ok'));

    it('keys the registry by template directory name', () => {
      expect(Object.keys(registry).sort()).toEqual(['full', 'text-only']);
    });

    it('strips a single trailing newline from the subject', () => {
      expect(registry.full.subject).toBe('Full {{x}}');
    });

    it('keeps the text body verbatim', () => {
      expect(registry.full.text).toBe('Body {{x}}\n');
    });

    it('includes html when body.html exists', () => {
      expect(registry.full.html).toBe('<p>{{x}}</p>\n');
    });

    it('omits the html key when body.html is absent', () => {
      expect('html' in registry['text-only']).toBe(false);
    });

    it('keeps content raw / pre-interpolation', () => {
      expect(registry.full.text).toContain('{{x}}');
      expect(registry.full.subject).toContain('{{x}}');
    });

    it('freezes the registry and each entry', () => {
      expect(Object.isFrozen(registry)).toBe(true);
      expect(Object.isFrozen(registry.full)).toBe(true);
      expect(Object.isFrozen(registry['text-only'])).toBe(true);
    });
  });

  it('throws naming the first missing file for a broken template', () => {
    expect(() => buildTemplateRegistry(fixture('templates-broken'))).toThrow(
      "mail: template 'broken' is missing body.txt",
    );
  });

  it('returns an empty registry for a directory with no template subdirectories', () => {
    expect(buildTemplateRegistry(fixture('templates-empty'))).toEqual({});
  });

  it('returns an empty registry when the directory does not exist', () => {
    expect(buildTemplateRegistry(fixture('does-not-exist'))).toEqual({});
  });
});
