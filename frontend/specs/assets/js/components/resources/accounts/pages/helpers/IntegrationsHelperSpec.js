import { renderToStaticMarkup } from 'react-dom/server';
import IntegrationsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/IntegrationsHelper.jsx';
import { CLOSED_ADD_FORM } from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/IntegrationsController.js';

describe('IntegrationsHelper', () => {
  const handlers = { onRetry: jasmine.createSpy('onRetry') };
  const markupOf = (loadState) => renderToStaticMarkup(IntegrationsHelper.render({
    integrations: [], types: [], loadState, rowState: new Map(), addForm: CLOSED_ADD_FORM,
  }, handlers));

  it('renders the heading', () => {
    expect(markupOf({ loading: false, error: null })).toContain('<h1>Integrations</h1>');
  });

  it('renders the loading state', () => {
    expect(markupOf({ loading: true, error: null })).toContain('Loading integrations');
  });

  it('renders the error state with a retry action', () => {
    const markup = markupOf({ loading: false, error: 'GitHub is unavailable' });

    expect(markup).toContain('GitHub is unavailable');
    expect(markup).toContain('Retry');
  });
});
