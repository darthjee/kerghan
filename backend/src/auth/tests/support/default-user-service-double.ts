import { ConflictException } from '@nestjs/common';
import { ErrorCodes } from '../../../core/error-codes.js';
import { DEFAULT_USER_MANAGED_MESSAGE, DefaultUserService } from '../../default-user.service.js';

export type DefaultUserServiceDouble = {
  isDefaultUser: jest.Mock<boolean, [number]>;
  assertNotDefaultUser: jest.Mock<void, [number]>;
};

// A `DefaultUserService` stand-in for the service unit specs: `defaultUserId`
// is the id boot sync would have recorded, `null` when the feature is
// disabled (nothing is the default user, nothing is blocked). Throws the same
// `409 DEFAULT_USER_MANAGED` as the real service.
export function defaultUserServiceDouble(defaultUserId: number | null = null): DefaultUserServiceDouble {
  const isDefaultUser = jest.fn((userId: number) => defaultUserId !== null && userId === defaultUserId);

  return {
    isDefaultUser,
    assertNotDefaultUser: jest.fn((userId: number) => {
      if (isDefaultUser(userId)) {
        throw new ConflictException({ code: ErrorCodes.DEFAULT_USER_MANAGED, message: DEFAULT_USER_MANAGED_MESSAGE });
      }
    }),
  };
}

export function asDefaultUserService(double: DefaultUserServiceDouble): DefaultUserService {
  return double as unknown as DefaultUserService;
}

// Asserts that `promise` rejects with the documented `409 DEFAULT_USER_MANAGED`.
export async function expectDefaultUserManaged(promise: Promise<unknown>): Promise<void> {
  const error = await promise.then(
    () => { throw new Error('expected a 409 DEFAULT_USER_MANAGED rejection'); },
    (rejection: unknown) => rejection,
  );

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getResponse()).toEqual({
    code: ErrorCodes.DEFAULT_USER_MANAGED,
    message: DEFAULT_USER_MANAGED_MESSAGE,
  });
}
