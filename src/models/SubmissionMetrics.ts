import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

@Entity('submission_metrics')
@Index(['submission_id'])
@Index(['created_at'])
export class SubmissionMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  submission_id: string;

  @Column({ type: 'int', default: 0 })
  likes: number;

  @Column({ type: 'int', default: 0 })
  comments: number;

  @Column({ type: 'int', default: 0 })
  shares: number;

  @Column({ type: 'bigint', default: 0 })
  views: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  engagement_score: number;

  @Column({ type: 'json', nullable: true })
  raw_metrics: any;

  @Column({ type: 'varchar', length: 20, nullable: true })
  platform: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne('ContestSubmission', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: any;
}
