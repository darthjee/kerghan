import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/**
 * A `ParseUUIDPipe` whose failure answers `400 VALIDATION_FAILED` with the message as `details`
 * (the array message path of the exception filter), instead of the bare `BAD_REQUEST` category.
 * Any uuid version is accepted.
 * @returns {ParseUUIDPipe} The pipe, for `@Param('id', uuidParamPipe())`.
 */
export function uuidParamPipe(): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: (message: string) => new BadRequestException({ message: [message] }),
  });
}
