import { buildPasswordRecoveryEmail } from '../events/password-recovery-email.content.js';

describe('buildPasswordRecoveryEmail', () => {
  const resetUrl = 'https://app.example/#/recover-password?token=abc123';
  const result = buildPasswordRecoveryEmail(resetUrl);

  it('uses the fixed subject line', () => {
    expect(result.subject).toBe('Reset your Kerghan password');
  });

  it('places the reset URL on a line by itself', () => {
    expect(result.text.split('\n')).toContain(resetUrl);
  });

  it('explains the link is single-use and can expire', () => {
    expect(result.text).toContain('can only be used once');
  });

  it('reassures a user who did not request the reset', () => {
    expect(result.text).toContain('If you didn\'t ask to reset your password');
  });

  it('has no html body', () => {
    expect(result).not.toHaveProperty('html');
  });
});
