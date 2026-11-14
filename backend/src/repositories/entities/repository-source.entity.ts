import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Which source returned a repository, as of that source's last applied page,
 * and on which page. Owns table `repositories_sources` (see
 * `docs/agents/specs/repos/model.md#repositories_sources`). `userId` is
 * denormalised for per-user/per-source cleanup without a join.
 */
@Entity('repositories_sources')
@Index('idx_repositories_sources_repository_id_source_key', ['repositoryId', 'sourceKey'], { unique: true })
@Index('idx_repositories_sources_user_id_source_key_page', ['userId', 'sourceKey', 'page'])
export class RepositorySource {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int' })
    userId!: number;

  @Column({ name: 'repository_id', type: 'int' })
    repositoryId!: number;

  @Column({ name: 'source_key', type: 'varchar', length: 32 })
    sourceKey!: string;

  @Column({ type: 'smallint' })
    page!: number;
}
