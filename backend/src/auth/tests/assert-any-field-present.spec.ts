import { BadRequestException } from '@nestjs/common';
import { assertAnyFieldPresent, hasManagedField } from '../assert-any-field-present.js';

describe('assertAnyFieldPresent', () => {
  it('throws BadRequestException when username, email, and newPassword are all absent', () => {
    expect(() => assertAnyFieldPresent({})).toThrow(
      new BadRequestException('At least one of username, email, or newPassword is required'),
    );
  });

  it('does not throw when only username is present', () => {
    expect(() => assertAnyFieldPresent({ username: 'alice' })).not.toThrow();
  });

  it('does not throw when only email is present', () => {
    expect(() => assertAnyFieldPresent({ email: 'alice@example.com' })).not.toThrow();
  });

  it('does not throw when only newPassword is present', () => {
    expect(() => assertAnyFieldPresent({ newPassword: 'new-password' })).not.toThrow();
  });
});

describe('hasManagedField', () => {
  it('is false when no managed field is present', () => {
    expect(hasManagedField({})).toBe(false);
  });

  it.each([
    ['username', { username: 'alice' }],
    ['email', { email: 'alice@example.com' }],
    ['newPassword', { newPassword: 'new-password' }],
  ])('is true when %s is present', (_field, dto) => {
    expect(hasManagedField(dto)).toBe(true);
  });
});
