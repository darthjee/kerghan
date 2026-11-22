import React from 'react';
import ProjectHeaderHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';
import { buildProject, buildProjectRepository, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectHeaderHelper', () => {
  const idle = { active: false, secondsLeft: 0, label: null };
  const handlers = { onImport: jasmine.createSpy('onImport'), onRefresh: jasmine.createSpy('onRefresh') };
  const stateOf = (overrides, extra) => ({
    project: buildProject(overrides), refreshing: false, notice: null, error: null, countdown: idle, ...extra,
  });
  const treeOf = (overrides, extra) => ProjectHeaderHelper.render(stateOf(overrides, extra), handlers);
  const outputOf = (overrides, extra) => renderedOutput(React.createElement('div', null, treeOf(overrides, extra)));

  it('shows the name as the title', () => {
    expect(outputOf({ name: 'Kerghan' }).containsElement('h1', 'Kerghan')).toBe(true);
  });

  it('wraps long names anywhere (U8)', () => {
    const [title] = findElements(treeOf(), (node) => node.type === 'h1');

    expect(title.props.style.overflowWrap).toBe('anywhere');
  });

  it('shows the description as plain text', () => {
    expect(outputOf({ description: 'Issue monitoring' }).containsElement('p', 'Issue monitoring')).toBe(true);
  });

  it('shows no description paragraph without one', () => {
    expect(outputOf({ description: null }).containsTag('p')).toBe(false);
    expect(outputOf({ description: '' }).containsTag('p')).toBe(false);
  });

  it('shows the repository with its status badge', () => {
    const output = outputOf();

    expect(output.contains('darthjee/kerghan')).toBe(true);
    expect(output.containsElement('span', 'Added')).toBe(true);
  });

  it('shows "No repository" for a project without one', () => {
    expect(outputOf({ repository: null }).contains('No repository')).toBe(true);
  });

  it('offers an Edit action to the management page', () => {
    const output = outputOf();

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/edit`)).toBe(true);
    expect(output.containsElement('a', 'Edit')).toBe(true);
  });

  it('offers a New issue action to the issue creation form', () => {
    const output = outputOf();

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/issues/new`)).toBe(true);
    expect(output.containsElement('a', 'New issue')).toBe(true);
  });

  it('renders the name and description as text, never as markup (S1)', () => {
    const output = outputOf({ name: '<img src=x onerror=alert(1)>', description: '<script>alert(1)</script>' });

    expect(output.contains('<img')).toBe(false);
    expect(output.contains('<script>')).toBe(false);
    expect(output.contains('&lt;script&gt;')).toBe(true);
  });

  describe('repository actions', () => {
    it('offers Import from GitHub and Refresh project when the project has a repository', () => {
      const tree = treeOf();

      expect(findButton(tree, 'Import from GitHub')).toBeDefined();
      expect(findButton(tree, 'Refresh project')).toBeDefined();
    });

    it('offers neither without a repository', () => {
      const tree = treeOf({ repository: null });

      expect(findButton(tree, 'Import from GitHub')).toBeUndefined();
      expect(findButton(tree, 'Refresh project')).toBeUndefined();
    });

    it('wires the buttons to the handlers', () => {
      const tree = treeOf();

      findButton(tree, 'Import from GitHub').props.onClick();
      findButton(tree, 'Refresh project').props.onClick();

      expect(handlers.onImport).toHaveBeenCalled();
      expect(handlers.onRefresh).toHaveBeenCalled();
    });

    it('U2: disables Refresh project and reads Refreshing... while it runs', () => {
      expect(findButton(treeOf({}, { refreshing: true }), 'Refreshing…').props.disabled).toBeTrue();
    });

    it('shows the rate-limit countdown on Refresh project and disables it', () => {
      const tree = treeOf({}, { countdown: { active: true, secondsLeft: 3, label: 'Try again in 3 s' } });

      expect(findButton(tree, 'Try again in 3 s').props.disabled).toBeTrue();
    });
  });

  describe('repository hints', () => {
    it('shows none for an added repository', () => {
      expect(outputOf().contains('Unavailable:')).toBe(false);
      expect(outputOf().contains('Unknown:')).toBe(false);
    });

    it('shows the Unavailable hint with a link to the repositories page', () => {
      const output = outputOf({ repository: buildProjectRepository({ status: 'unavailable' }) });

      expect(output.contains('Unavailable: sync and linking are paused')).toBe(true);
      expect(output.containsAttribute('href', '#/repositories')).toBe(true);
    });

    it('shows the Unknown hint', () => {
      expect(outputOf({ repository: buildProjectRepository({ status: 'unknown' }) }).contains('Unknown: not seen in the last repository sync')).toBe(true);
    });
  });

  describe('refresh notice and error', () => {
    it('shows the notice', () => {
      expect(outputOf({}, { notice: 'Everything is up to date' }).contains('Everything is up to date')).toBe(true);
    });

    it('shows the described error as text (S1)', () => {
      const output = outputOf({}, { error: { message: '<b>x</b>' } });

      expect(output.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
      expect(output.contains('<b>')).toBe(false);
    });
  });
});
