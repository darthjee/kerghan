import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import IntegrationErrors from '../../../../../../../../assets/js/components/resources/accounts/pages/integrations/errorMessages.js';

describe('IntegrationErrors', () => {
  describe('.messageFor', () => {
    [
      'INTEGRATION_LABEL_TAKEN',
      'INTEGRATIONS_LIMIT_REACHED',
      'INTEGRATION_CREDENTIAL_LOCKED',
      'INTEGRATION_CREDENTIAL_INVALID',
      'INTEGRATION_INSUFFICIENT_PERMISSIONS',
      'INTEGRATION_TEST_COOLDOWN',
      'INTEGRATION_REDIRECT_STATE_INVALID',
      'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE',
      'INTEGRATION_INSTALLATION_SUSPENDED',
      'GITHUB_UNAVAILABLE',
      'GITHUB_RATE_LIMITED',
      'VALIDATION_FAILED',
    ].forEach((code) => {
      it(`maps ${code} to friendly text`, () => {
        const message = IntegrationErrors.messageFor(new ApiError(400, 'raw api message', code));

        expect(message).not.toBe('raw api message');
        expect(message.length).toBeGreaterThan(0);
      });
    });

    it('includes the validation message for VALIDATION_FAILED', () => {
      expect(IntegrationErrors.messageFor(new ApiError(400, 'label is too long', 'VALIDATION_FAILED')))
        .toBe('Some fields are invalid: label is too long');
    });

    it('includes the Retry-After seconds for the test cooldown', () => {
      const error = new ApiError(429, 'Too soon', 'INTEGRATION_TEST_COOLDOWN', undefined, 12);

      expect(IntegrationErrors.messageFor(error)).toContain('12 seconds');
    });

    it('explains an expired or reused redirect state', () => {
      expect(IntegrationErrors.messageFor(new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID')))
        .toBe('This GitHub authorization link expired or was already used. Start again.');
    });

    it('uses the github_app text for an expired or reused redirect state', () => {
      expect(IntegrationErrors.messageFor(new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID'), 'github_app'))
        .toBe('This GitHub link expired or was already used. Start again.');
    });

    it('keeps the generic text for a type without an override', () => {
      expect(IntegrationErrors.messageFor(new ApiError(400, 'raw', 'INTEGRATION_REDIRECT_STATE_INVALID'), 'oauth_app'))
        .toBe('This GitHub authorization link expired or was already used. Start again.');
      expect(IntegrationErrors.messageFor(new ApiError(409, 'raw', 'INTEGRATION_LABEL_TAKEN'), 'github_app'))
        .toContain('already have an integration with this label');
    });

    it('explains an inaccessible installation', () => {
      expect(IntegrationErrors.messageFor(new ApiError(422, 'raw', 'INTEGRATION_INSTALLATION_NOT_ACCESSIBLE')))
        .toBe('Your GitHub account can\'t access that installation of Kerghan\'s GitHub App. '
          + 'Install it, or ask the account\'s owner to.');
    });

    it('explains a suspended installation', () => {
      expect(IntegrationErrors.messageFor(new ApiError(422, 'raw', 'INTEGRATION_INSTALLATION_SUSPENDED')))
        .toBe('This installation is suspended on GitHub. Unsuspend it in the account\'s GitHub '
          + 'settings, then try again.');
    });

    it('falls back to the API message for an unknown code', () => {
      expect(IntegrationErrors.messageFor(new ApiError(404, 'Not found', 'NOT_FOUND'))).toBe('Not found');
    });

    it('falls back to a generic message without a message', () => {
      expect(IntegrationErrors.messageFor(new Error(''))).toBe('Request failed');
      expect(IntegrationErrors.messageFor(undefined)).toBe('Request failed');
    });
  });
});
