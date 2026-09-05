import type { MailConfig } from '../mail.config.js';
import { MailService } from '../mail.service.js';

const enabledConfig: MailConfig = Object.freeze({
  enabled: true,
  from: 'no-reply@kerghan.local',
  transport: Object.freeze({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  }),
});

const disabledConfig: MailConfig = Object.freeze({ enabled: false, from: '', transport: null });

const validParams = {
  to: 'user@example.com',
  subject: 'Subject line',
  text: 'PLAIN_BODY_SECRET',
  html: '<p>HTML_BODY_SECRET</p>',
};

describe('MailService', () => {
  let sendMail: jest.Mock;
  let transporter: { sendMail: jest.Mock };
  let logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    sendMail = jest.fn();
    transporter = { sendMail };
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when enabled and the send succeeds', () => {
    beforeEach(() => {
      sendMail.mockResolvedValue({ messageId: 'abc', accepted: ['user@example.com'], rejected: [] });
    });

    it('calls sendMail once with the message fields and returns a sent result', async () => {
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      const result = await service.send({ ...validParams });

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@kerghan.local',
        to: 'user@example.com',
        subject: 'Subject line',
        text: 'PLAIN_BODY_SECRET',
        html: '<p>HTML_BODY_SECRET</p>',
      });
      expect(result).toEqual({ status: 'sent', messageId: 'abc' });
    });

    it('falls back to the configured from address when params omit it', async () => {
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await service.send({ ...validParams });

      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'no-reply@kerghan.local' }));
    });

    it('uses an explicit from address when params provide one', async () => {
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await service.send({ ...validParams, from: 'alerts@kerghan.local' });

      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'alerts@kerghan.local' }));
    });
  });

  describe('when email is disabled', () => {
    it('skips the send, logs a debug line and never touches the transporter', async () => {
      const service = new MailService(transporter as never, disabledConfig, logger as never);

      const result = await service.send({ ...validParams });

      expect(result).toEqual({ status: 'skipped' });
      expect(sendMail).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'email disabled; skipping send',
        expect.objectContaining({
          context: 'MailService',
          to: 'user@example.com',
          subject: 'Subject line',
        }),
      );
    });
  });

  describe('when sendMail rejects', () => {
    it('rejects with the same error and logs without leaking the bodies', async () => {
      const error = new Error('transport exploded');
      sendMail.mockRejectedValue(error);
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await expect(service.send({ ...validParams })).rejects.toBe(error);

      expect(logger.error).toHaveBeenCalledTimes(1);
      const [, attrs] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
      expect(attrs.reason).toBe('transport exploded');
      expect(JSON.stringify(attrs)).not.toContain('PLAIN_BODY_SECRET');
      expect(JSON.stringify(attrs)).not.toContain('HTML_BODY_SECRET');
      expect(attrs.reason).not.toContain('Error:');
    });
  });

  describe('when the recipient is rejected', () => {
    it('rejects with an error naming the rejected recipient', async () => {
      sendMail.mockResolvedValue({ accepted: [], rejected: ['user@example.com'] });
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await expect(service.send({ ...validParams })).rejects.toThrow('user@example.com');
    });
  });

  describe('when the to field is blank', () => {
    it.each([['empty', ''], ['whitespace', '   ']])('rejects without calling sendMail (%s)', async (_label, to) => {
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await expect(service.send({ ...validParams, to })).rejects.toThrow("mail: 'to' is required");
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  describe('when enabled but the transporter was never built', () => {
    it('rejects instead of dereferencing a null transporter', async () => {
      const service = new MailService(null as never, enabledConfig, logger as never);

      await expect(service.send({ ...validParams })).rejects.toThrow(
        'mail: transporter is not configured',
      );
    });
  });

  describe('when a header field contains a newline', () => {
    it('rejects via the header-injection guard without calling sendMail', async () => {
      const service = new MailService(transporter as never, enabledConfig, logger as never);

      await expect(
        service.send({ ...validParams, subject: 'Hi\nBcc: evil@example.com' }),
      ).rejects.toThrow('mail: header field contains a newline');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
