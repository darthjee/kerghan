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

    it('falls back to the API message for an unknown code', () => {
      expect(IntegrationErrors.messageFor(new ApiError(404, 'Not found', 'NOT_FOUND'))).toBe('Not found');
    });

    it('falls back to a generic message without a message', () => {
      expect(IntegrationErrors.messageFor(new Error(''))).toBe('Request failed');
      expect(IntegrationErrors.messageFor(undefined)).toBe('Request failed');
    });
  });
});
