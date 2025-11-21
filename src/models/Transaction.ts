import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TransactionType, TransactionStatus } from '../types';
import { Wallet } from './Wallet';

@Entity('transactions')
@Index(['wallet_id'])
@Index(['user_id'])
@Index(['transaction_type'])
@Index(['status'])
@Index(['created_at'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  wallet_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  amount: number;

  @Column({
    type: 'varchar',
    length: 50
  })
  transaction_type: TransactionType;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending'
  })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Wallet, wallet => wallet.transactions)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}