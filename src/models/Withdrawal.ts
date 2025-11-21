import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';
import { Transaction } from './Transaction';

@Entity('withdrawals')
@Index(['user_id'])
@Index(['status'])
@Index(['requested_at'])
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 100 })
  bank_account_name: string;

  @Column({ type: 'varchar', length: 20 })
  bank_account_number: string;

  @Column({ type: 'varchar', length: 100 })
  bank_name: string;

  @Column({ type: 'varchar', length: 20 })
  bank_code: string;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2 
  })
  amount: number;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2 
  })
  fee: number;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2 
  })
  net_amount: number;

  @Column({ type: 'varchar', length: 10, default: 'NGN' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // 'pending', 'processing', 'completed', 'failed', 'cancelled'

  @Column({ type: 'varchar', length: 255, nullable: true })
  rejection_reason?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  external_reference?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  admin_notes?: string;

  @Column({ type: 'uuid', nullable: true })
  processed_by?: string;

  @Column({ type: 'uuid', nullable: true })
  transaction_id?: string; // Reference to transaction record

  @Column({ type: 'datetime', nullable: true })
  processed_at?: Date;

  @Column({ type: 'datetime', nullable: true })
  completed_at?: Date;

  @CreateDateColumn()
  requested_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;
}

