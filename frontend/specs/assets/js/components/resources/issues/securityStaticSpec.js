import React from 'react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import IssueFieldsHelper from '../../../../../../assets/js/components/resources/issues/pages/form/IssueFieldsHelper.jsx';
import IssueHeaderHelper from '../../../../../../assets/js/components/resources/issues/pages/show/IssueHeaderHelper.jsx';
import IssuesTableHelper from '../../../../../../assets/js/components/resources/issues/list/helpers/IssuesTableHelper.jsx';
import IssueFormController from '../../../../../../assets/js/components/resources/issues/pages/form/IssueFormController.js';
import IssueActionsController from '../../../../../../assets/js/components/resources/issues/pages/show/IssueActionsController.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../support/fakeWindow.js';
import {
  buildIssue, buildProject, ISSUE_ID, PROJECT_ID,
} from '../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

const SOURCE_ROOT = fileURLToPath(new URL('../../../../../../assets/js/components/', import.meta.url));
const ISSUE_DIRECTORY = path.join(SOURCE_ROOT, 'resources/issues');
const COUNTDOWN_FILES = [
  'common/forms/RateLimitCountdownController.js',
  'common/forms/hooks/useRateLimitCountdown.js',
].map((file) => path.join(SOURCE_ROOT, file));

/**
 * List every source file under a directory, recursively.
 *
 * @param {string} directory - The absolute directory.
 * @returns {string[]} The absolute paths of its files.
 */
function filesUnder(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);

    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const issueFiles = filesUnder(ISSUE_DIRECTORY);
const checkedFiles = [...issueFiles, ...COUNTDOWN_FILES];
const readAll = (files) => files.map((file) => [path.relative(SOURCE_ROOT, file), readFileSync(file, 'utf8')]);
const offendersOf = (files, pattern) => readAll(files).filter(([, source]) => pattern.test(source)).map(([file]) => file);

describe('Issues security (static)', () => {
  it('finds the source files it checks', () => {
    expect(issueFiles.length).toBeGreaterThan(20);
    expect(checkedFiles.length).toBe(issueFiles.length + 2);
  });

  describe('S1: titles and bodies are text, never markup', () => {
    it('uses no dangerouslySetInnerHTML in the issue components or the countdown', () => {
      expect(offendersOf(checkedFiles, /dangerouslySetInnerHTML/)).toEqual([]);
    });

    it('sets no innerHTML or outerHTML either', () => {
      expect(offendersOf(checkedFiles, /\.(inner|outer)HTML\b/)).toEqual([]);
    });

    it('imports no rehype plugin (no raw HTML) under components/resources/issues', () => {
      expect(offendersOf(issueFiles, /(from|import)\s*\(?\s*['"][^'"]*rehype/)).toEqual([]);
    });

    describe('a title such as <b>x</b>', () => {
      const title = '<b>x</b>';

      it('shows as escaped text in the list', () => {
        const output = renderedOutput(IssuesTableHelper.render(PROJECT_ID, [buildIssue({ title })]));

        expect(output.contains('<b>')).toBe(false);
        expect(output.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
      });

      it('shows as escaped text on the issue page', () => {
        const output = renderedOutput(IssueHeaderHelper.render(buildProject(), buildIssue({ title })));

        expect(output.contains('<b>')).toBe(false);
        expect(output.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
      });

      it('shows as an escaped value in the forms', () => {
        const state = {
          title, body: '', state: 'open', tab: 'write', fieldErrors: {},
        };
        const output = renderedOutput(React.createElement('div', null, IssueFieldsHelper.renderTitle(state, {
          onTitleChange: () => undefined,
        })));

        expect(output.contains('<b>')).toBe(false);
        expect(output.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
      });
    });
  });

  describe('S4: no draft is saved to localStorage or sessionStorage', () => {
    it('never uses either storage in the issue components or the countdown', () => {
      expect(offendersOf(checkedFiles, /\b(localStorage|sessionStorage)\s*[.[]/)).toEqual([]);
    });

    describe('at runtime', () => {
      let fakeWindow;

      beforeEach(() => {
        fakeWindow = installFakeWindow(new EventTarget());
        fakeWindow.location = { hash: `#/projects/${PROJECT_ID}/issues/new` };
        fakeWindow.localStorage = jasmine.createSpyObj('localStorage', ['setItem']);
        fakeWindow.sessionStorage = jasmine.createSpyObj('sessionStorage', ['setItem']);
      });

      afterEach(() => {
        uninstallFakeWindow();
      });

      it('the issue forms and actions never call setItem, on success or refusal', async () => {
        const client = jasmine.createSpyObj('client', ['create', 'edit', 'delete']);
        const setters = {
          setFieldErrors: () => undefined, setFormError: () => undefined, setSubmitting: () => undefined,
        };
        const fields = { title: 'Secret plans', body: 'Draft body', state: 'open' };

        client.create.and.resolveTo(buildIssue());
        client.edit.and.rejectWith(new Error('nope'));
        client.delete.and.resolveTo({});

        await new IssueFormController(setters, () => undefined, client).create(PROJECT_ID, fields, () => undefined);
        await new IssueFormController(setters, () => undefined, client).save(PROJECT_ID, ISSUE_ID, fields, () => undefined);
        await new IssueActionsController({
          setIssue: () => undefined, setBusy: () => undefined, setError: () => undefined, onNotFound: () => undefined,
        }, client, { push: () => undefined }).toggleState(PROJECT_ID, buildIssue());

        expect(fakeWindow.localStorage.setItem).not.toHaveBeenCalled();
        expect(fakeWindow.sessionStorage.setItem).not.toHaveBeenCalled();
      });
    });
  });

  describe('S5: no integration or credential data on the issue screens', () => {
    it('names no integration, credential or secret in the issue components', () => {
      expect(offendersOf(issueFiles, /integration|credential|secret|token/i)).toEqual([]);
    });
  });
});
