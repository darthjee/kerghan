import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../../assets', import.meta.url).pathname;

/**
 * List every file under a directory, recursively.
 *
 * @param {string} directory - The directory to walk.
 * @returns {Array<string>} The file paths.
 */
function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => (
    entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]
  ));
}

describe('frontend sources', () => {
  it('never reference the GitHub API host', () => {
    const offenders = filesUnder(ROOT).filter(
      (file) => /\.(js|jsx|css|html)$/.test(file) && readFileSync(file, 'utf8').includes('api.github.com'),
    );

    expect(offenders).toEqual([]);
  });

  it('actually walks the sources', () => {
    expect(filesUnder(ROOT).length).toBeGreaterThan(50);
  });
});
