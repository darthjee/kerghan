# Point assertAnyFieldPresent at the shared type

Replace `assert-any-field-present.ts`'s local `FieldsDto` interface with the new
`UserFieldChangesDto`, so there is exactly one declaration of this three-field shape in the
codebase instead of two:

```ts
import { UserFieldChangesDto } from './dto/user-field-changes.dto.js';

export function assertAnyFieldPresent(dto: UserFieldChangesDto): void {
  if (!dto.username && !dto.email && !dto.newPassword) {
    throw new BadRequestException('At least one of username, email, or newPassword is required');
  }
}
```

Both call sites (`AccountService#updateAccount`, `AdminService#editUser`) already pass an
`UpdateAccountDto`/`AdminUpdateUserDto` instance, both of which now extend `UserFieldChangesDto` —
no call-site change needed.

## Files to Change
- `backend/src/auth/assert-any-field-present.ts` — drop the local `FieldsDto` interface, import
  and use `UserFieldChangesDto` as the parameter type instead; update the file's docstring
  reference from "Fields shared by `UpdateAccountDto` and `AdminUpdateUserDto`" to reference
  `UserFieldChangesDto` directly.
