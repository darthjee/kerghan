import IssueChangedBanner from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueChangedBanner.jsx';
import IssueFormHelper from '../../../../../../../../assets/js/components/resources/issues/pages/form/IssueFormHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildLink } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueFormHelper', () => {
  const handlers = {
    onTitleChange: () => undefined,
    onBodyChange: () => undefined,
    onStateChange: () => undefined,
    onTabChange: () => undefined,
    onSubmit: jasmine.createSpy('onSubmit'),
    onCancel: jasmine.createSpy('onCancel'),
    onDiscardAndReload: jasmine.createSpy('onDiscardAndReload'),
  };
  const state = (overrides) => ({
    mode: 'edit',
    title: 'Fix',
    body: 'Steps',
    state: 'open',
    tab: 'write',
    link: null,
    fieldErrors: {},
    formError: null,
    submitting: false,
    countdown: { active: false, secondsLeft: 0, label: null },
    ...overrides,
  });
  const treeOf = (overrides) => IssueFormHelper.render(state(overrides), handlers);
  const outputOf = (overrides) => renderedOutput(treeOf(overrides));
  const buttons = (tree) => findElements(tree, (node) => node.type === 'button' && node.props.type !== 'tab' && node.props.role !== 'tab');

  it('renders the creation form: Title and Body, no State, "Create issue" and Cancel', () => {
    const output = outputOf({ mode: 'new' });

    expect(output.containsElement('h1', 'New issue')).toBe(true);
    expect(output.contains('Title')).toBe(true);
    expect(output.contains('issue-state')).toBe(false);
    expect(output.contains('Create issue')).toBe(true);
    expect(output.contains('Cancel')).toBe(true);
  });

  it('renders the edit form: Title, Body, State, "Save" and Cancel', () => {
    const output = outputOf();

    expect(output.containsElement('h1', 'Edit issue')).toBe(true);
    expect(output.contains('issue-state')).toBe(true);
    expect(output.contains('Save')).toBe(true);
  });

  it('wires submit and Cancel', () => {
    const tree = treeOf();
    const [form] = findElements(tree, (node) => node.type === 'form');
    const cancel = buttons(tree).find((button) => button.props.children === 'Cancel');

    expect(form.props.onSubmit).toBe(handlers.onSubmit);
    expect(cancel.props.onClick).toBe(handlers.onCancel);
  });

  it('shows no link note for an unlinked issue and none on the creation form', () => {
    expect(outputOf().containsAttribute('class', 'alert alert-info')).toBe(false);
    expect(outputOf({ mode: 'new', link: buildLink() }).containsAttribute('class', 'alert alert-info')).toBe(false);
  });

  it('says changes are sent to GitHub for a linked issue', () => {
    expect(outputOf({ link: buildLink({ number: 12 }) }).contains('Changes are sent to GitHub issue #12')).toBe(true);
  });

  it('says changes stay in Kerghan when the GitHub issue is gone', () => {
    const output = outputOf({ link: buildLink({ state: 'gone', states: ['gone'] }) });

    expect(output.contains('The GitHub issue is gone; changes stay in Kerghan.')).toBe(true);
    expect(output.contains('Changes are sent to GitHub')).toBe(false);
  });

  it('shows the form-level error as an alert, with its details', () => {
    const output = outputOf({ formError: { message: 'Invalid', details: ['title is too long'] } });

    expect(output.containsAttribute('role', 'alert')).toBe(true);
    expect(output.contains('Invalid')).toBe(true);
    expect(output.containsElement('li', 'title is too long')).toBe(true);
  });

  it('U2: disables both buttons while the call is in flight', () => {
    const [submit, cancel] = buttons(treeOf({ submitting: true }));

    expect(submit.props.disabled).toBe(true);
    expect(cancel.props.disabled).toBe(true);
  });

  it('keeps Save disabled and reads "Try again in N s" while a rate limit runs', () => {
    const [submit] = buttons(treeOf({ countdown: { active: true, secondsLeft: 4, label: 'Try again in 4 s' } }));

    expect(submit.props.disabled).toBe(true);
    expect(submit.props.children).toContain('Try again in 4 s');
  });

  describe('U10: the changed banner', () => {
    const bannerOf = (overrides) => findElements(treeOf(overrides), (node) => node.type === IssueChangedBanner);

    it('U10: is hidden while the issue is unchanged', () => {
      expect(bannerOf({ changed: false })[0].props.visible).toBe(false);
    });

    it('U10: is shown once the issue changed, wired to discard-and-reload', () => {
      const [banner] = bannerOf({ changed: true });

      expect(banner.props.visible).toBe(true);
      expect(banner.props.onDiscard).toBe(handlers.onDiscardAndReload);
    });

    it('U10: Save stays enabled while the banner shows (last-write-wins)', () => {
      const submit = buttons(treeOf({ changed: true })).find((button) => button.props.type === 'submit');

      expect(submit.props.disabled).toBe(false);
    });

    it('U10: the new-issue form has no banner', () => {
      expect(bannerOf({ mode: 'new', changed: true })).toEqual([]);
    });
  });
});
