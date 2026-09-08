import type { TemplateRegistry } from './template-registry.js';

/**
 * The interpolated output of {@link renderTemplate}: `subject` and `text`
 * substituted verbatim, `html` substituted with HTML-escaped values and
 * present only when the source template carried a `body.html`.
 */
export interface RenderedTemplate {
  subject: string;
  text: string;
  html?: string;
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * HTML-escapes a substituted value. Escapes `&` first so the entities
 * introduced by the later replacements are not double-escaped.
 * @param {string} value - The raw substitution value.
 * @returns {string} The value with `& < > " '` replaced by entities.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Substitutes every `{{ name }}` placeholder in `text` from `variables`.
 * @param {string} text - The raw template string.
 * @param {Record<string, string>} variables - The substitution map.
 * @param {boolean} escape - Whether to HTML-escape each substituted value.
 * @param {string} templateName - The template name, for error messages.
 * @returns {string} The interpolated string.
 * @throws {Error} When a referenced placeholder has no own key in `variables`.
 */
function interpolate(
  text: string,
  variables: Record<string, string>,
  escape: boolean,
  templateName: string,
): string {
  return text.replace(PLACEHOLDER, (_match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      throw new Error(`mail: template '${templateName}' is missing variable '${key}'`);
    }

    return escape ? escapeHtml(variables[key]) : variables[key];
  });
}

/**
 * Renders one raw template from `registry` against `variables`. `subject`
 * and `text` are interpolated verbatim; `html` is interpolated with each
 * substituted value HTML-escaped and is only present when the raw template
 * had a `body.html`. Pure — the registry is passed in, so no `fs` or env
 * access happens here.
 * @param {TemplateRegistry} registry - The frozen raw template registry.
 * @param {string} templateName - The template directory name to render.
 * @param {Record<string, string>} variables - The substitution map;
 *   unreferenced extra keys are ignored.
 * @returns {RenderedTemplate} The interpolated subject/text (and html when
 *   the template defines one).
 * @throws {Error} When `templateName` is unknown or a referenced
 *   placeholder has no matching key in `variables`.
 */
export function renderTemplate(
  registry: TemplateRegistry,
  templateName: string,
  variables: Record<string, string>,
): RenderedTemplate {
  const raw = registry[templateName];

  if (!raw) {
    throw new Error(`mail: unknown template: ${templateName}`);
  }

  const rendered: RenderedTemplate = {
    subject: interpolate(raw.subject, variables, false, templateName),
    text: interpolate(raw.text, variables, false, templateName),
  };

  if ('html' in raw && raw.html !== undefined) {
    rendered.html = interpolate(raw.html, variables, true, templateName);
  }

  return rendered;
}
