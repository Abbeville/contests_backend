import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User';
import { Contest } from './Contest';

@Entity('contest_submissions')
@Index(['contest_id'])
@Index(['user_id'])
@Index(['submitted_at'])
@Index(['status'])
export class ContestSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  contest_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 500 })
  post_url: string;

  @Column({ nullable: true })
  post_id: string;

  @Column({ nullable: true })
  platform: string;

  @Column({ type: 'text', nullable: true })
  post_content: string;

  @Column({ type: 'json', nullable: true })
  media_urls: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: 'submitted'
  })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  prize_amount: number;

  @CreateDateColumn()
  submitted_at: Date;

  @Column({ type: 'datetime', nullable: true })
  reviewed_at: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string;

  // Relations
  @ManyToOne(() => Contest, contest => contest.submissions)
  @JoinColumn({ name: 'contest_id' })
  contest: Contest;

  @ManyToOne(() => User, user => user.contest_submissions)
  @JoinColumn({ name: 'user_id' })
  user: User;
}