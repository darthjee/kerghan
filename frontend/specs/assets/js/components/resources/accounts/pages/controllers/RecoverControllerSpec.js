import RecoverController from '../../../../../../../../assets/js/components/resources/accounts/pages/controllers/RecoverController.js';

describe('RecoverController', () => {
  let setSent;
  let client;

  const email = 'foo@example.com';

  beforeEach(() => {
    setSent = jasmine.createSpy('setSent');
    client = jasmine.createSpyObj('client', ['recover']);
  });

  describe('#handleSubmit', () => {
    it('requests recovery for the given email', async () => {
      client.recover.and.resolveTo({ sent: true });
      const controller = new RecoverController(setSent, client);

      await controller.handleSubmit(email);

      expect(client.recover).toHaveBeenCalledWith(email);
    });

    it('flips to the sent state when the request resolves', async () => {
      client.recover.and.resolveTo({ sent: true });
      const controller = new RecoverController(setSent, client);

      await controller.handleSubmit(email);

      expect(setSent).toHaveBeenCalledWith(true);
    });

    it('flips to the sent state when the request rejects', async () => {
      client.recover.and.rejectWith(new Error('network error'));
      const controller = new RecoverController(setSent, client);

      await expectAsync(controller.handleSubmit(email)).toBeRejected();

      expect(setSent).toHaveBeenCalledWith(true);
    });
  });
});
