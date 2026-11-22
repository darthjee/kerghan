import ConfirmModal from '../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import DirtyFormPrompt from '../../../../../../assets/js/components/common/forms/DirtyFormPrompt.jsx';

describe('DirtyFormPrompt', () => {
  const buildGuard = (pendingHash) => ({
    pendingHash,
    confirmLeave: jasmine.createSpy('confirmLeave'),
    cancelLeave: jasmine.createSpy('cancelLeave'),
  });

  it('renders nothing when no hash is pending (a clean form leaves silently)', () => {
    expect(DirtyFormPrompt({ guard: buildGuard(null) })).toBeNull();
  });

  it('asks "Discard unsaved changes?" through a danger ConfirmModal', () => {
    const element = DirtyFormPrompt({ guard: buildGuard('#/projects') });

    expect(element.type).toBe(ConfirmModal);
    expect(element.props.title).toBe('Discard unsaved changes?');
    expect(element.props.confirmLabel).toBe('Discard changes');
    expect(element.props.danger).toBe(true);
  });

  it('wires confirm and cancel to the guard', () => {
    const guard = buildGuard('#/projects');
    const element = DirtyFormPrompt({ guard });

    expect(element.props.onConfirm).toBe(guard.confirmLeave);
    expect(element.props.onCancel).toBe(guard.cancelLeave);
  });
});
