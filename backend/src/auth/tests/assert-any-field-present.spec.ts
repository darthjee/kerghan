import { BadRequestException } from '@nestjs/common';
import {
  ACCOUNT_EDIT_FIELDS,
  ADMIN_EDIT_FIELDS,
  assertAnyFieldPresent,
  hasManagedField,
} from '../assert-any-field-present.js';

const ACCOUNT_MESSAGE = 'At least one of username, email, newPassword or githubHandle is required';
const ADMIN_MESSAGE = 'At least one of username, email, or newPassword is required';

describe('assertAnyFieldPresent', () => {
  describe('with the account edit rule', () => {
    it('throws BadRequestException with the account message when every field is absent', () => {
      expect(() => assertAnyFieldPresent({}, ACCOUNT_EDIT_FIELDS)).toThrow(new BadRequestException(ACCOUNT_MESSAGE));
    });

    it('ignores an undefined githubHandle', () => {
      expect(() => assertAnyFieldPresent({ githubHandle: undefined }, ACCOUNT_EDIT_FIELDS))
        .toThrow(new BadRequestException(ACCOUNT_MESSAGE));
    });

    it.each([
      ['username', { username: 'alice' }],
      ['email', { email: 'alice@example.com' }],
      ['newPassword', { newPassword: 'new-password' }],
      ['githubHandle', { githubHandle: 'alice' }],
      ['a null githubHandle (clear)', { githubHandle: null }],
    ])('does not throw when only %s is present', (_field, dto) => {
      expect(() => assertAnyFieldPresent(dto, ACCOUNT_EDIT_FIELDS)).not.toThrow();
    });
  });

  describe('with the admin edit rule', () => {
    it('throws BadRequestException with the unchanged admin message when every field is absent', () => {
      expect(() => assertAnyFieldPresent({}, ADMIN_EDIT_FIELDS)).toThrow(new BadRequestException(ADMIN_MESSAGE));
    });

    it('does not count githubHandle', () => {
      expect(() => assertAnyFieldPresent({ githubHandle: 'alice' }, ADMIN_EDIT_FIELDS))
        .toThrow(new BadRequestException(ADMIN_MESSAGE));
    });

    it.each([
      ['username', { username: 'alice' }],
      ['email', { email: 'alice@example.com' }],
      ['newPassword', { newPassword: 'new-password' }],
    ])('does not throw when only %s is present', (_field, dto) => {
      expect(() => assertAnyFieldPresent(dto, ADMIN_EDIT_FIELDS)).not.toThrow();
    });
  });
});

describe('hasManagedField', () => {
  it('is false when no managed field is present', () => {
    expect(hasManagedField({})).toBe(false);
  });

  it('is false when only githubHandle is present', () => {
    expect(hasManagedField({ githubHandle: 'alice' } as never)).toBe(false);
  });

  it.each([
    ['username', { username: 'alice' }],
    ['email', { email: 'alice@example.com' }],
    ['newPassword', { newPassword: 'new-password' }],
  ])('is true when %s is present', (_field, dto) => {
    expect(hasManagedField(dto)).toBe(true);
  });
});
