import { BadRequestException } from '@nestjs/common';
import { uuidParamPipe } from '../uuid-param.pipe.js';

const META = { type: 'param' as const, metatype: String, data: 'projectId' };

describe('uuidParamPipe', () => {
  it('passes a uuid through', async () => {
    const uuid = '3f0c1f8e-0000-4000-8000-000000000001';

    await expect(uuidParamPipe().transform(uuid, META)).resolves.toBe(uuid);
  });

  it('refuses a non-uuid with an array message, so the filter answers VALIDATION_FAILED', async () => {
    const error = await uuidParamPipe().transform('nope', META).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ message: [expect.stringContaining('uuid')] }),
    );
  });
});
