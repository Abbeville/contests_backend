import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

@Entity('bank_accounts')
@Index(['user_id'])
@Index(['is_active'])
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  account_name: string;

  @Column({ type: 'varchar', length: 20 })
  account_number: string;

  @Column({ type: 'varchar', length: 100 })
  bank_name: string;

  @Column({ type: 'varchar', length: 20 })
  bank_code: string;

  @Column({ type: 'varchar', length: 10 })
  account_type: string; // 'savings' or 'current'

  @Column({ type: 'varchar', length: 20 })
  routing_number?: string;

  @Column({ type: 'varchar', length: 10, default: 'NGN' })
  currency: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  verification_token?: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

