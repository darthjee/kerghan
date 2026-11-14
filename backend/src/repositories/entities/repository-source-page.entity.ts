import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One fetched page of one source of one user: its `etag`, whether a next page
 * existed and when it was fetched. Owns table `repositories_source_pages`
 * (see `docs/agents/modules/repositories.md#repositories_source_pages`). Never
 * shared between users.
 */
@Entity('repositories_source_pages')
@Index('idx_repositories_source_pages_user_id_source_key_page', ['userId', 'sourceKey', 'page'], { unique: true })
export class RepositorySourcePage {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'source_key', type: 'varchar', length: 32 })
    sourceKey!: string;

  @Column({ type: 'smallint' })
    page!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
    etag!: string | null;

  @Column({ name: 'has_next', type: 'boolean' })
    hasNext!: boolean;

  @Column({ name: 'fetched_at', type: 'datetime' })
    fetchedAt!: Date;
}
