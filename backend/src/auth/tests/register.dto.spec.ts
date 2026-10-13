import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../dto/register.dto.js';
import { PASSWORD_MIN_LENGTH } from '../password-rules.js';

async function passwordErrors(password: string): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, { username: 'jane', email: 'jane@example.com', password });
  const errors = await validate(dto);

  return errors.filter((error) => error.property === 'password').map((error) => error.property);
}

describe('RegisterDto', () => {
  it('rejects a password shorter than PASSWORD_MIN_LENGTH', async () => {
    expect(await passwordErrors('x'.repeat(PASSWORD_MIN_LENGTH - 1))).toEqual(['password']);
  });

  it('accepts a password of exactly PASSWORD_MIN_LENGTH', async () => {
    expect(await passwordErrors('x'.repeat(PASSWORD_MIN_LENGTH))).toEqual([]);
  });
});
