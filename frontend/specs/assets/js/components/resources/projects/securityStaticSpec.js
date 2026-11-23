import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ProjectsClient from '../../../../../../assets/js/client/ProjectsClient.js';
import ProjectNewController from '../../../../../../assets/js/components/resources/projects/pages/new/ProjectNewController.js';
import ProjectDetailsController from '../../../../../../assets/js/components/resources/projects/pages/edit/ProjectDetailsController.js';
import HashRouteResolver from '../../../../../../assets/js/utils/routing/HashRouteResolver.js';
import Router from '../../../../../../assets/js/utils/routing/Router.js';
import { isUuid } from '../../../../../../assets/js/utils/ids/uuid.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../support/fakeWindow.js';
import { buildProject, PROJECT_ID } from '../../../../../support/issuesBuilders.js';

const SOURCE_ROOT = fileURLToPath(new URL('../../../../../../assets/js/components/', import.meta.url));
const SCREEN_DIRECTORIES = ['resources/projects', 'common/confirmModal', 'common/forms'];
const SCREEN_FILES = [
  'resources/repositories/pages/repositories/ProjectShortcutStore.js',
  'resources/issues/list/helpers/IssuesBulkBarHelper.jsx',
  'resources/issues/list/controllers/BulkSelectionController.js',
];

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

const projectFiles = filesUnder(path.join(SOURCE_ROOT, 'resources/projects'));
const screenFiles = [
  ...SCREEN_DIRECTORIES.flatMap((directory) => filesUnder(path.join(SOURCE_ROOT, directory))),
  ...SCREEN_FILES.map((file) => path.join(SOURCE_ROOT, file)),
];
const readAll = (files) => files.map((file) => [path.relative(SOURCE_ROOT, file), readFileSync(file, 'utf8')]);

describe('Issues and Projects security (static)', () => {
  it('finds the source files it checks', () => {
    expect(projectFiles.length).toBeGreaterThan(20);
    expect(screenFiles.length).toBeGreaterThan(projectFiles.length);
  });

  it('checks the bulk bar and its controller (#563)', () => {
    const checked = screenFiles.map((file) => path.basename(file));

    expect(checked).toContain('IssuesBulkBarHelper.jsx');
    expect(checked).toContain('BulkSelectionController.js');
  });

  describe('S1: names, descriptions and errors are text, never markup', () => {
    it('uses no dangerouslySetInnerHTML in the project screens, ConfirmModal, the form guard or the bulk selection', () => {
      const offenders = readAll(screenFiles).filter(([, source]) => source.includes('dangerouslySetInnerHTML'));

      expect(offenders.map(([file]) => file)).toEqual([]);
    });

    it('sets no innerHTML or outerHTML either', () => {
      const offenders = readAll(screenFiles).filter(([, source]) => /\.(inner|outer)HTML\b/.test(source));

      expect(offenders.map(([file]) => file)).toEqual([]);
    });
  });

  describe('S4: no draft is saved to localStorage or sessionStorage', () => {
    it('never uses either storage in the project screens, ConfirmModal, the form guard or the bulk selection', () => {
      const offenders = readAll(screenFiles).filter(([, source]) => /\b(localStorage|sessionStorage)\s*[.[]/.test(source));

      expect(offenders.map(([file]) => file)).toEqual([]);
    });

    describe('at runtime', () => {
      let fakeWindow;

      beforeEach(() => {
        fakeWindow = installFakeWindow(new EventTarget());
        fakeWindow.location = { hash: '#/projects/new' };
        fakeWindow.localStorage = jasmine.createSpyObj('localStorage', ['setItem']);
        fakeWindow.sessionStorage = jasmine.createSpyObj('sessionStorage', ['setItem']);
      });

      afterEach(() => {
        uninstallFakeWindow();
      });

      it('the create and edit forms never call setItem, on success or refusal', async () => {
        const client = jasmine.createSpyObj('client', ['create', 'edit']);
        const setters = {
          setFieldErrors: () => undefined, setFormError: () => undefined, setSubmitting: () => undefined,
        };
        const fields = { name: 'Kerghan', description: 'Secret notes', repository: null };

        client.create.and.resolveTo(buildProject());
        client.edit.and.rejectWith(new Error('nope'));

        await new ProjectNewController(setters, client).submit(fields, () => undefined);
        await new ProjectDetailsController(setters, () => undefined, client).save(PROJECT_ID, fields, () => undefined);

        expect(fakeWindow.localStorage.setItem).not.toHaveBeenCalled();
        expect(fakeWindow.sessionStorage.setItem).not.toHaveBeenCalled();
      });
    });
  });

  describe('S5: no integration or credential data on the project screens', () => {
    it('names no integration, credential or secret in the project screens', () => {
      // errorMessages.js words the GITHUB_CREDENTIAL_UNUSABLE error: a code and a sentence, no data.
      const offenders = readAll(projectFiles.filter((file) => path.basename(file) !== 'errorMessages.js'))
        .filter(([, source]) => /integration|credential|secret|token/i.test(source));

      expect(offenders.map(([file]) => file)).toEqual([]);
    });
  });

  describe('S3: a crafted hash cannot change the request path', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      globalThis.fetch = jasmine.createSpy('fetch');
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('resolves #/projects/..%2Fadmin to the project route with an id failing the uuid guard, so no fetch is made', async () => {
      const hash = '#/projects/..%2Fadmin';
      const page = new HashRouteResolver(() => hash).getPage();
      const { projectId } = Router.extractParams('/projects/:projectId', hash);

      expect(page).toBe('project');
      expect(projectId).toBe('..%2Fadmin');
      expect(isUuid(projectId)).toBe(false);
      await expectAsync(ProjectsClient.show(projectId)).toBeRejectedWith(jasmine.objectContaining({ status: 404 }));
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('also keeps the management route off the network', async () => {
      const hash = '#/projects/..%2Fadmin/edit';
      const { projectId } = Router.extractParams('/projects/:projectId/edit', hash);

      expect(new HashRouteResolver(() => hash).getPage()).toBe('project-edit');
      await expectAsync(ProjectsClient.show(projectId)).toBeRejected();
      await expectAsync(ProjectsClient.delete(projectId)).toBeRejected();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
