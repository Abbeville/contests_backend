import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SocialMediaPlatform } from '../types';
import { User } from './User';

@Entity('social_media_accounts')
@Index(['user_id'])
@Index(['platform'])
@Index(['platform_user_id'])
export class SocialMediaAccount {
  @PrimaryGeneratedColumn('uuid')
  
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({
    type: 'varchar',
    length: 20
  })
  platform: SocialMediaPlatform;

  @Column()
  platform_user_id: string;

  @Column()
  username: string;

  @Column({ type: 'text' })
  access_token: string;

  @Column({ type: 'text', nullable: true })
  refresh_token: string;

  // Persisted stats for eligibility/targeting
  @Column({ type: 'int', default: 0 })
  follower_count: number;

  @Column({ type: 'int', default: 0 })
  following_count: number;

  @Column({ type: 'int', default: 0 })
  likes_count: number;

  @Column({ type: 'int', default: 0 })
  video_count: number;

  @Column({ type: 'bigint', default: 0 })
  views_count: number;

  @Column({ type: 'int', default: 0 })
  tweet_count: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.social_accounts)
  @JoinColumn({ name: 'user_id' })
  user: User;
}