import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/authorization-requests/:uuid/authorize.json`. */
export class AuthorizeAuthorizationRequestDto {
  @IsString()
  @IsNotEmpty()
    password!: string;
}
