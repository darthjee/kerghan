# Extend UpdateAccountDto and AdminUpdateUserDto from the shared base

Make both DTOs extend `UserFieldChangesDto` instead of re-declaring its fields:

- `AdminUpdateUserDto` becomes an empty subclass (`export class AdminUpdateUserDto extends UserFieldChangesDto {}`) — it adds no fields of its own. Keep its existing docstring (the business-rule/`currentPassword`/`isAdmin` notes are still accurate and not derivable from the shared base alone).
- `UpdateAccountDto` extends `UserFieldChangesDto` and keeps only its own extra `currentPassword` field:

```ts
export class UpdateAccountDto extends UserFieldChangesDto {
  @IsString()
  @IsNotEmpty()
    currentPassword!: string;
}
```

Keep `UpdateAccountDto`'s existing docstring. Both files' `class-validator` imports shrink to only
what their own remaining code still uses directly (`UpdateAccountDto` still needs `IsString`/
`IsNotEmpty` for `currentPassword`; `AdminUpdateUserDto` needs none, since it has no fields of its
own — drop its now-unused `class-validator` import entirely).

## Files to Change
- `backend/src/auth/dto/admin-update-user.dto.ts` — replace the duplicated field block with
  `extends UserFieldChangesDto {}`; import `UserFieldChangesDto` from `./user-field-changes.dto.js`; drop the now-unused `class-validator` import.
- `backend/src/auth/dto/update-account.dto.ts` — replace the duplicated field block with `extends UserFieldChangesDto`, keeping only `currentPassword`; import `UserFieldChangesDto` from `./user-field-changes.dto.js`; trim the `class-validator` import to `IsString`/`IsNotEmpty`.
