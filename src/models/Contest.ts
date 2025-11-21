import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { ContestStatus, ContestType } from '../types';
import { User } from './User';
import { ContestParticipant } from './ContestParticipant';
import { ContestSubmission } from './ContestSubmission';

@Entity('contests')
@Index(['brand_id'])
@Index(['status'])
@Index(['contest_type'])
@Index(['start_date'])
@Index(['end_date'])
export class Contest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  rules: string;

  @Column({ type: 'uuid' })
  brand_id: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'photo'
  })
  contest_type: ContestType;

  @Column({ nullable: true })
  platform: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft'
  })
  status: ContestStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  prize_pool: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  entry_fee: number;

  @Column({ type: 'datetime', nullable: true })
  start_date: Date;

  @Column({ type: 'datetime', nullable: true })
  end_date: Date;

  @Column({ type: 'datetime', nullable: true })
  submission_deadline: Date;

  @Column({ type: 'int', nullable: true })
  max_participants: number;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({ type: 'text', nullable: true })
  judging_criteria: string;

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'engagement' })
  judging_method: string;

  @Column({ type: 'json', nullable: true })
  engagement_weights: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ nullable: true })
  cover_image_url: string;

  @Column({ type: 'int', nullable: true })
  min_followers: number;

  @Column({ type: 'json', nullable: true })
  hashtags: string[];

  @Column({ nullable: true })
  brand_name: string;

  @Column({ nullable: true })
  brand_logo: string;

  @Column({ default: false })
  is_boosted: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  boost_amount: number;

  @Column({ default: 0 })
  entries_count: number;

  @Column({ type: 'int', default: 1 })
  winner_count: number;

  @Column({ type: 'json', nullable: true })
  prize_distribution: { place: number; amount: number; percentage: number }[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.created_contests)
  @JoinColumn({ name: 'brand_id' })
  brand: User;

  @OneToMany(() => ContestParticipant, participant => participant.contest)
  participants: ContestParticipant[];

  @OneToMany(() => ContestSubmission, submission => submission.contest)
  submissions: ContestSubmission[];
}