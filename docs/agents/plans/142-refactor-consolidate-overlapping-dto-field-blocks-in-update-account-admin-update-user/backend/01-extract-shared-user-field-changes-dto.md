# Extract shared UserFieldChangesDto

Create a new DTO class holding exactly the `username`/`email`/`newPassword` block that is
currently character-for-character duplicated between `UpdateAccountDto` and
`AdminUpdateUserDto`, decorators included:

```ts
export class UserFieldChangesDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
    username?: string;

  @IsOptional()
  @IsEmail()
    email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
    newPassword?: string;
}
```

Give it a short docstring stating it's the shared field block for `UpdateAccountDto` and
`AdminUpdateUserDto` (and the type `assertAnyFieldPresent` validates against), so a future reader
doesn't need to chase both subclasses to understand why it exists.

## Files to Change
- `backend/src/auth/dto/user-field-changes.dto.ts` — new file, holds `UserFieldChangesDto` as
  described above.
