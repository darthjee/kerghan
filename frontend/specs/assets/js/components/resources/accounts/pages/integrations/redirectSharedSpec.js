import RedirectShared from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/redirectShared.js';

describe('RedirectShared', () => {
  describe('.upsert', () => {
    it('prepends a new integration', () => {
      expect(RedirectShared.upsert([{ id: 'a' }], { id: 'b' })).toEqual([{ id: 'b' }, { id: 'a' }]);
    });

    it('replaces an existing integration in place', () => {
      const updated = { id: 'b', label: 'New' };

      expect(RedirectShared.upsert([{ id: 'a' }, { id: 'b' }], updated)).toEqual([{ id: 'a' }, updated]);
    });
  });

  describe('.reporterFor', () => {
    let controller;

    beforeEach(() => {
      controller = jasmine.createSpyObj('controller', ['patchRow', 'patchAddForm']);
    });

    it('reports to the row for a reconnect', () => {
      RedirectShared.reporterFor(controller, { integrationId: 'x' })('oops');

      expect(controller.patchRow).toHaveBeenCalledWith('x', { error: 'oops' });
    });

    it('reports to the add form for a create', () => {
      RedirectShared.reporterFor(controller, { label: 'Work' })('oops');

      expect(controller.patchAddForm).toHaveBeenCalledWith({ error: 'oops' });
    });
  });

  describe('.showLandingNotice', () => {
    const notices = new Map([['cancelled', { variant: 'warning', text: 'Cancelled' }]]);
    let controller;

    beforeEach(() => {
      controller = jasmine.createSpyObj('controller', ['setNotice']);
    });

    it('shows the notice of a known kind', () => {
      expect(RedirectShared.showLandingNotice(controller, notices, { kind: 'cancelled' })).toBeTrue();
      expect(controller.setNotice).toHaveBeenCalledWith({ variant: 'warning', text: 'Cancelled' });
    });

    it('shows nothing for a callback', () => {
      expect(RedirectShared.showLandingNotice(controller, notices, { kind: 'callback' })).toBeFalse();
      expect(controller.setNotice).not.toHaveBeenCalled();
    });
  });
});
