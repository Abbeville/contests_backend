import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, Index } from 'typeorm';
import { UserType } from '../types';
import { UserProfile } from './UserProfile';
import { Wallet } from './Wallet';
import { Contest } from './Contest';
import { ContestParticipant } from './ContestParticipant';
import { ContestSubmission } from './ContestSubmission';
import { SocialMediaAccount } from './SocialMediaAccount';
import { SupportTicket } from './SupportTicket';
import { Transaction } from './Transaction';
import { Notification } from './Notification';

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['user_type'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'creator'
  })
  user_type: UserType;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => UserProfile, profile => profile.user)
  profile: UserProfile;

  @OneToOne(() => Wallet, wallet => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Contest, contest => contest.brand)
  created_contests: Contest[];

  @OneToMany(() => ContestParticipant, participant => participant.user)
  contest_participations: ContestParticipant[];

  @OneToMany(() => ContestSubmission, submission => submission.user)
  contest_submissions: ContestSubmission[];

  @OneToMany(() => SocialMediaAccount, account => account.user)
  social_accounts: SocialMediaAccount[];

  @OneToMany(() => SupportTicket, ticket => ticket.user)
  support_tickets: SupportTicket[];

  @OneToMany(() => Transaction, transaction => transaction.wallet)
  transactions: Transaction[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];
}