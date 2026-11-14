import GithubHandleHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/GithubHandleHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('GithubHandleHelper', () => {
  const buildState = (overrides = {}) => ({
    handle: 'octocat',
    loading: false,
    loadError: null,
    fieldError: null,
    submitError: null,
    successMessage: null,
    saving: false,
    ...overrides,
  });
  const handlers = { onSubmit: () => undefined, onChange: () => undefined };
  const renderPage = (overrides) => renderedOutput(
    GithubHandleHelper.render(buildState(overrides), handlers),
  );

  describe('.render', () => {
    it('renders the heading, input, help text and Save button', () => {
      const page = renderPage();

      expect(page.contains('GitHub handle')).withContext('heading').toBeTrue();
      expect(page.containsAttribute('id', 'my-account-github-handle')).withContext('input id').toBeTrue();
      expect(page.containsAttribute('value', 'octocat')).withContext('value').toBeTrue();
      expect(page.contains('Your public GitHub repositories are listed on the Repositories page. Leave empty to remove it.'))
        .withContext('help').toBeTrue();
      expect(page.containsElement('button', 'Save')).withContext('save').toBeTrue();
      expect(page.contains('disabled')).withContext('disabled').toBeFalse();
    });

    it('renders no password field', () => {
      const page = renderPage();

      expect(page.contains('type="password"')).withContext('password').toBeFalse();
      expect(page.contains('Current password')).withContext('label').toBeFalse();
    });

    it('is disabled while loading', () => {
      expect(renderPage({ loading: true }).contains('disabled')).toBeTrue();
    });

    it('is disabled while saving', () => {
      expect(renderPage({ saving: true }).contains('disabled')).toBeTrue();
    });

    it('is disabled and shows the load error when loading failed', () => {
      const page = renderPage({ loadError: 'Could not load your GitHub handle.' });

      expect(page.contains('disabled')).withContext('disabled').toBeTrue();
      expect(page.containsElement('div', 'Could not load your GitHub handle.')).withContext('alert').toBeTrue();
    });

    it('shows the inline field error', () => {
      const page = renderPage({ fieldError: 'Bad handle' });

      expect(page.containsElement('div', 'Bad handle')).withContext('feedback').toBeTrue();
      expect(page.contains('is-invalid')).withContext('class').toBeTrue();
    });

    it('shows the submit error', () => {
      expect(renderPage({ submitError: 'Server said no' }).containsElement('div', 'Server said no')).toBeTrue();
    });

    ['GitHub handle updated.', 'GitHub handle removed.'].forEach((message) => {
      it(`shows the success message "${message}"`, () => {
        expect(renderPage({ successMessage: message }).containsElement('div', message)).toBeTrue();
      });
    });
  });
});
