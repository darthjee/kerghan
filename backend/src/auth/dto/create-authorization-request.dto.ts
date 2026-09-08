import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/authorization-requests.json`. */
export class CreateAuthorizationRequestDto {
  @IsString()
  @IsNotEmpty()
    username!: string;
}
