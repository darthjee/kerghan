import type { MailService } from '../../mail/mail.service.js';
import { PasswordRecoveryRequestedListener } from '../events/password-recovery-requested.listener.js';

describe('PasswordRecoveryRequestedListener', () => {
  const event = {
    userId: 1,
    token: 'plain-token-SECRET',
    resetUrl: 'https://app.example/#/recover-password?token=plain-token-SECRET',
    email: 'darthjee@example.com',
  };

  let send: jest.Mock;
  let logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let listener: PasswordRecoveryRequestedListener;

  beforeEach(() => {
    send = jest.fn();
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    listener = new PasswordRecoveryRequestedListener(
      { send } as unknown as MailService,
      logger as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when the send succeeds', () => {
    beforeEach(() => {
      send.mockResolvedValue({ status: 'sent', messageId: 'mid-1' });
    });

    it('sends exactly one message to the account address', async () => {
      await listener.handlePasswordRecoveryRequested(event);

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith({
        to: 'darthjee@example.com',
        subject: 'Reset your Kerghan password',
        text: expect.stringContaining(event.resetUrl),
      });
    });

    it('passes no from or html key', async () => {
      await listener.handlePasswordRecoveryRequested(event);

      const params = send.mock.calls[0][0];

      expect(params).not.toHaveProperty('from');
      expect(params).not.toHaveProperty('html');
    });

    it('logs one debug line with the messageId and user id', async () => {
      await listener.handlePasswordRecoveryRequested(event);

      expect(logger.debug).toHaveBeenCalledWith(
        'recovery email sent',
        expect.objectContaining({
          context: 'PasswordRecoveryRequestedListener',
          userId: 1,
          messageId: 'mid-1',
        }),
      );
    });

    it('resolves', async () => {
      await expect(listener.handlePasswordRecoveryRequested(event)).resolves.toBeUndefined();
    });
  });

  describe('when email is disabled', () => {
    beforeEach(() => {
      send.mockResolvedValue({ status: 'skipped' });
    });

    it('resolves without logging', async () => {
      await expect(listener.handlePasswordRecoveryRequested(event)).resolves.toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('when the transport fails', () => {
    beforeEach(() => {
      send.mockRejectedValue(new Error('transport exploded'));
    });

    it('resolves instead of throwing', async () => {
      await expect(listener.handlePasswordRecoveryRequested(event)).resolves.toBeUndefined();
    });

    it('logs one warn line with the user id and the reason', async () => {
      await listener.handlePasswordRecoveryRequested(event);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const [, attrs] = logger.warn.mock.calls[0] as [string, Record<string, unknown>];
      expect(attrs.userId).toBe(1);
      expect(attrs.reason).toContain('transport exploded');
    });

    it('never logs the token or the body copy', async () => {
      await listener.handlePasswordRecoveryRequested(event);

      const logged = JSON.stringify(logger.warn.mock.calls[0]);

      expect(logged).not.toContain('plain-token-SECRET');
      expect(logged).not.toContain('can only be used once');
    });
  });

  describe('when the recipient is rejected', () => {
    beforeEach(() => {
      send.mockRejectedValue(new Error('mail: recipient rejected: darthjee@example.com'));
    });

    it('still resolves and logs a warn line', async () => {
      await expect(listener.handlePasswordRecoveryRequested(event)).resolves.toBeUndefined();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
