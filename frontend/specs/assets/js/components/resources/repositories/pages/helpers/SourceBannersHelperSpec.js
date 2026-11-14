import React from 'react';
import SourceBannersHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/SourceBannersHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { buildSource, buildSyncState } from '../../../../../../../support/repositoriesBuilders.js';

const noop = Function.prototype;

describe('SourceBannersHelper', () => {
  const handle = (status, extra = {}) => ({
    kind: 'handle', handle: 'darthjee', status, syncedAt: 'T1', resetAt: null, ...extra,
  });
  const handlers = { onDismiss: jasmine.createSpy('onDismiss').and.returnValue(noop) };
  const render = (sources, dismissed = new Set()) => React.createElement(
    'div', null, SourceBannersHelper.render(buildSyncState({ sources }), dismissed, handlers),
  );
  const output = (sources, dismissed) => renderedOutput(render(sources, dismissed));

  ['ok', 'pending'].forEach((status) => {
    it(`renders nothing for ${status}`, () => {
      expect(output([buildSource({ status })]).containsTag('button')).toBeFalse();
    });
  });

  it('renders the invalid credentials banner with the Integrations link for an integration', () => {
    const page = output([buildSource({ status: 'invalid_credentials' })]);

    expect(page.contains('integration &quot;work-pat&quot; failed: invalid credentials.')).toBeTrue();
    expect(page.containsAttribute('href', '#/account/integrations')).toBeTrue();
    expect(page.contains('Fix it in Integrations')).toBeTrue();
  });

  it('renders no invalid credentials banner for the handle source', () => {
    expect(output([handle('invalid_credentials')]).containsTag('button')).toBeFalse();
  });

  it('renders the rate limit banner with the local reset time', () => {
    const resetAt = '2026-11-07T11:40:00Z';
    const page = output([handle('rate_limited', { resetAt })]);

    expect(page.contains('GitHub handle &quot;darthjee&quot; hit GitHub&#x27;s rate limit; it will retry after')).toBeTrue();
    expect(page.contains(new Date(resetAt).toLocaleString())).toBeTrue();
  });

  it('renders the page cap banner', () => {
    expect(output([handle('page_cap_reached')]).contains('has more repositories than Kerghan reads; some may be missing.')).toBeTrue();
  });

  it('renders the not found banner linking to Account, never Integrations', () => {
    const page = output([handle('not_found')]);

    expect(page.contains('was not found on GitHub.')).toBeTrue();
    expect(page.containsAttribute('href', '#/account/my-account')).toBeTrue();
    expect(page.containsAttribute('href', '#/account/integrations')).toBeFalse();
  });

  it('renders the error banner without a link', () => {
    const page = output([buildSource({ status: 'error' })]);

    expect(page.contains('could not be read from GitHub; its repositories may be out of date.')).toBeTrue();
    expect(page.containsTag('a')).toBeFalse();
  });

  it('hides a dismissed banner', () => {
    const source = buildSource({ status: 'error' });
    const dismissed = new Set(['integration:uuid-1|error|2026-11-07T11:00:00Z']);

    expect(output([source], dismissed).containsTag('button')).toBeFalse();
  });

  it('brings the banner back for a new syncedAt', () => {
    const source = buildSource({ status: 'error', syncedAt: '2026-11-07T12:00:00Z' });
    const dismissed = new Set(['integration:uuid-1|error|2026-11-07T11:00:00Z']);

    expect(output([source], dismissed).containsTag('button')).toBeTrue();
  });

  it('dismisses through the handler', () => {
    const source = buildSource({ status: 'error' });
    const [button] = findElements(render([source]), (node) => node.type === 'button');

    expect(button.props.onClick).toEqual(jasmine.any(Function));
    expect(handlers.onDismiss).toHaveBeenCalledWith(source);
  });
});
