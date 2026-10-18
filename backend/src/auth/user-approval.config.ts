import { ConfigService } from '@nestjs/config';
import { UserStatus } from './entities/user.entity.js';

// Env var name — `UserApprovalConfig` is its only reader.
const APPROVAL_REQUIRED = 'KERGHAN_USER_APPROVAL_REQUIRED';

/**
 * The single reader of `KERGHAN_USER_APPROVAL_REQUIRED`. Built once at boot
 * (see `auth.module.ts`'s factory provider). The flag only decides the status
 * of *new* registrations: on (exactly `'true'`, the codebase's boolean-flag
 * rule) → `pending`, unset or any other value → `approved`. It never touches
 * existing users and never disables the session gate.
 */
export class UserApprovalConfig {
  readonly #approvalRequired: boolean;

  /**
   * @param {boolean} approvalRequired - Whether new registrations wait for an admin's approval.
   */
  constructor(approvalRequired: boolean) {
    this.#approvalRequired = approvalRequired;
  }

  /**
   * Reads `KERGHAN_USER_APPROVAL_REQUIRED` once and builds the config.
   * @param {ConfigService} configService - Supplies the env value.
   * @returns {UserApprovalConfig} The resolved config.
   */
  static fromConfigService(configService: ConfigService): UserApprovalConfig {
    return new UserApprovalConfig(configService.get<string>(APPROVAL_REQUIRED) === 'true');
  }

  /**
   * @returns {boolean} Whether new registrations wait for an admin's approval.
   */
  isApprovalRequired(): boolean {
    return this.#approvalRequired;
  }

  /**
   * @returns {UserStatus} The status a newly registered user is created with:
   *   `pending` when approval is required, `approved` otherwise.
   */
  registrationStatus(): UserStatus {
    return this.#approvalRequired ? UserStatus.PENDING : UserStatus.APPROVED;
  }
}
