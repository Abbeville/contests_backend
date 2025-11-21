import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { User } from './User';
import { Transaction } from './Transaction';

@Entity('wallets')
@Index(['user_id'])
@Index(['is_active'])
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  balance: number;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  pending_balance: number;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  total_deposited: number;

  @Column({ 
    type: 'decimal', 
    precision: 15, 
    scale: 2, 
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  total_earned: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => User, user => user.wallet)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Transaction, transaction => transaction.wallet)
  transactions: Transaction[];
}