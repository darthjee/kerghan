import { ConfigService } from '@nestjs/config';
import { UserApprovalConfig } from '../user-approval.config.js';

function configWith(value: string | undefined): ConfigService {
  return { get: jest.fn(() => value) } as unknown as ConfigService;
}

describe('UserApprovalConfig', () => {
  describe('fromConfigService', () => {
    it('reads KERGHAN_USER_APPROVAL_REQUIRED', () => {
      const configService = configWith('true');

      UserApprovalConfig.fromConfigService(configService);

      expect(configService.get).toHaveBeenCalledWith('KERGHAN_USER_APPROVAL_REQUIRED');
    });

    it.each([
      ['unset', undefined, false, 'approved'],
      ['exactly "true"', 'true', true, 'pending'],
      ['"false"', 'false', false, 'approved'],
      ['an invalid value ("yes")', 'yes', false, 'approved'],
      ['"TRUE" (case-sensitive)', 'TRUE', false, 'approved'],
      ['empty', '', false, 'approved'],
    ])('when the flag is %s', (_label, value, required, status) => {
      const config = UserApprovalConfig.fromConfigService(configWith(value));

      expect(config.isApprovalRequired()).toBe(required);
      expect(config.registrationStatus()).toBe(status);
    });
  });
});
