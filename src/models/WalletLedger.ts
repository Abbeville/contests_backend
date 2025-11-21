import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('wallet_ledger')
@Index(['wallet_id'])
@Index(['user_id'])
@Index(['created_at'])
export class WalletLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  wallet_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 10 })
  entry_type: 'credit' | 'debit';

  @Column({ 
    type: 'decimal', precision: 15, scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) }
  })
  amount: number;

  @Column({ 
    type: 'decimal', precision: 15, scale: 2,
    transformer: { to: (v: number) => v, from: (v: string) => parseFloat(v) }
  })
  balance_after: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference?: string;

  @Column({ type: 'uuid', nullable: true })
  transaction_id?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  context?: string; // deposit, withdrawal, prize, fee, refund

  @CreateDateColumn()
  created_at: Date;
}


