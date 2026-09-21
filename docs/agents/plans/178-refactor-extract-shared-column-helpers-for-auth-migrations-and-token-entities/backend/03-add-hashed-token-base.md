# Add HashedTokenBase for token entities
Create an abstract `HashedTokenBase` (no `@Entity`) declaring the fields both token entities share, with the same decorators they use today:

- `@PrimaryGeneratedColumn() id!: number`
- `@Index({ unique: true }) @Column({ name: 'token_hash' }) tokenHash!: string`
- `@Column({ name: 'user_id' }) userId!: number`
- `@Column({ name: 'expires_at' }) expiresAt!: Date`

Make `RefreshToken` and `PasswordResetToken` extend it and remove the now-inherited fields. They keep their own `@CreateDateColumn` (`issuedAt` / `createdAt`) and nullable timestamp (`revokedAt` / `usedAt`), plus their `@Entity(...)` decorator and class JSDoc. Preserve the 4-space indentation on decorated fields and remove imports that become unused (`Index`, `PrimaryGeneratedColumn`, possibly `Column`). Public field names and types are unchanged, so services and specs that use the entities need no edits — confirm by running the existing Jest specs.

## Files to Change
- `backend/src/auth/entities/hashed-token.base.ts` — new abstract base class with the four shared fields and a JSDoc explaining it
- `backend/src/auth/entities/refresh-token.entity.ts` — extend `HashedTokenBase`, drop inherited fields/imports
- `backend/src/auth/entities/password-reset-token.entity.ts` — extend `HashedTokenBase`, drop inherited fields/imports
