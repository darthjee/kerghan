import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Raw, pre-interpolation content of one on-disk email template, read from
 * `templates/<name>/`. `subject` comes from `subject.txt` (single trailing
 * newline stripped), `text` from `body.txt` verbatim, and `html` from
 * `body.html` verbatim when that file exists — otherwise the key is absent.
 */
export interface RawTemplate {
  subject: string;
  text: string;
  html?: string;
}

/**
 * The frozen registry of {@link RawTemplate}s keyed by template directory
 * name, built once at boot by {@link buildTemplateRegistry}.
 */
export type TemplateRegistry = Readonly<Record<string, RawTemplate>>;

/**
 * Reads one template directory into a frozen {@link RawTemplate}.
 * @param {string} dir - Absolute path to the template directory.
 * @param {string} name - The template directory name, for error messages.
 * @returns {RawTemplate} The frozen raw template content.
 * @throws {Error} When `subject.txt` or `body.txt` is missing.
 */
function readTemplateDir(dir: string, name: string): RawTemplate {
  const subjectPath = join(dir, 'subject.txt');
  const bodyPath = join(dir, 'body.txt');
  const htmlPath = join(dir, 'body.html');

  if (!existsSync(subjectPath)) {
    throw new Error(`mail: template '${name}' is missing subject.txt`);
  }

  if (!existsSync(bodyPath)) {
    throw new Error(`mail: template '${name}' is missing body.txt`);
  }

  const template: RawTemplate = {
    subject: readFileSync(subjectPath, 'utf8').replace(/\r?\n$/, ''),
    text: readFileSync(bodyPath, 'utf8'),
  };

  if (existsSync(htmlPath)) {
    template.html = readFileSync(htmlPath, 'utf8');
  }

  return Object.freeze(template);
}

/**
 * Scans `templatesDir` for `<name>/` subdirectories and builds the frozen
 * raw template registry. Directories only are considered; a missing
 * `templatesDir` yields an empty frozen registry. Pure with respect to the
 * environment — takes the directory as a parameter and touches neither
 * `import.meta` nor `process`.
 * @param {string} templatesDir - Absolute path to the templates root.
 * @returns {TemplateRegistry} The frozen registry keyed by template name.
 * @throws {Error} When a template directory is missing `subject.txt` or
 *   `body.txt`.
 */
export function buildTemplateRegistry(templatesDir: string): TemplateRegistry {
  if (!existsSync(templatesDir)) {
    return Object.freeze({});
  }

  const registry: Record<string, RawTemplate> = {};

  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      registry[entry.name] = readTemplateDir(join(templatesDir, entry.name), entry.name);
    }
  }

  return Object.freeze(registry);
}
