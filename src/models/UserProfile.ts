import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { SocialMediaAccount } from './SocialMediaAccount';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  website: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => User, user => user.profile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SocialMediaAccount, account => account.user)
  social_accounts: SocialMediaAccount[];
}